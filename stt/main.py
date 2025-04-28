import os
import tempfile
import asyncio
import base64
import json
import time
import re
import threading
from typing import List, Dict, Any, Optional, Deque
from collections import deque
from queue import Queue

import numpy as np
import soundfile as sf
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from faster_whisper import WhisperModel

app = FastAPI(title="OnlySaid Speech-to-Text API")

# Initialize the Whisper model with medium size for better accuracy
model_size = "medium"
model = WhisperModel(model_size, device="cuda", compute_type="float16")
# Use "cpu" and "int8" if you don't have a GPU
# model = WhisperModel(model_size, device="cpu", compute_type="int8")

# Create a background transcription queue
transcription_queue = Queue()
results_queue = Queue()

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_text(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

manager = ConnectionManager()

class ContextManager:
    def __init__(self, max_context_length: int = 150):
        self.max_context_length = max_context_length
        self.context = ""
        self.language = None
        self.language_probability = 0.0
        self.last_segments = []
        
    def update_language(self, language: str, probability: float):
        """Update detected language if confidence is higher"""
        if not self.language or probability > self.language_probability:
            self.language = language
            self.language_probability = probability
    
    def clean_text(self, text: str) -> str:
        """Clean text by removing repetitions and normalizing spacing"""
        # Remove exact repetitions (same phrase repeated)
        if len(text) > 20:
            # Look for repeated phrases (at least 10 chars long)
            for length in range(min(50, len(text) // 2), 9, -1):
                for i in range(len(text) - length * 2):
                    phrase = text[i:i+length]
                    if phrase in text[i+length:]:
                        # Found a repetition, remove it
                        text = text.replace(phrase + phrase, phrase)
        
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        return text
    
    def update_context(self, new_segments, is_final: bool = False):
        """Update context with new segments, managing context size"""
        # Extract text from segments
        new_text = ""
        for segment in new_segments:
            new_text += segment.text + " "
        new_text = new_text.strip()
        
        if is_final:
            # For final transcription, just use the new text
            self.context = new_text
        else:
            # For interim results, intelligently merge with existing context
            if not self.context:
                self.context = new_text
            else:
                # Check if new_text is substantially different
                if len(new_text) > len(self.context) * 1.3:
                    # New text is much longer, use it
                    self.context = new_text
                elif len(new_text) > 10:
                    # Try to find overlap between context and new_text
                    overlap_found = False
                    for i in range(min(len(self.context), 50), 5, -1):
                        if self.context[-i:] in new_text[:i+10]:
                            # Found overlap, merge texts
                            overlap = self.context[-i:]
                            overlap_idx = new_text.find(overlap)
                            self.context = self.context[:-i] + new_text[overlap_idx:]
                            overlap_found = True
                            break
                    
                    if not overlap_found:
                        # No significant overlap, append with separator
                        self.context += " " + new_text
            
            # Clean up the context
            self.context = self.clean_text(self.context)
            
            # Limit context length
            if len(self.context) > self.max_context_length:
                # Keep the most recent text up to max_context_length
                self.context = self.context[-self.max_context_length:]
        
        # Store last segments for future reference
        self.last_segments = new_segments
        
        return self.context
    
    def get_prompt(self) -> str:
        """Get a prompt for the next transcription"""
        # Use a shorter version of context as prompt
        if len(self.context) > 50:
            return self.context[-50:]
        return self.context
    
    def get_language(self) -> Optional[str]:
        """Get the detected language"""
        return self.language
    
    def get_language_probability(self) -> float:
        """Get the language detection probability"""
        return self.language_probability

class AudioBuffer:
    def __init__(self, max_size_seconds: int = 60):
        self.max_size = max_size_seconds * 16000  # 16kHz sample rate
        self.buffer = bytearray()
        self.lock = threading.Lock()
    
    def add_audio(self, audio_bytes: bytes) -> None:
        """Add new audio to the buffer thread-safely"""
        with self.lock:
            self.buffer.extend(audio_bytes)
            # Trim if exceeds max size
            if len(self.buffer) > self.max_size:
                self.buffer = self.buffer[-self.max_size:]
    
    def get_window(self, window_size_seconds: int = 10) -> bytes:
        """Get the most recent window of audio thread-safely"""
        window_size = window_size_seconds * 16000
        with self.lock:
            if len(self.buffer) > window_size:
                return bytes(self.buffer[-window_size:])
            return bytes(self.buffer)
    
    def get_full(self) -> bytes:
        """Get the full buffer thread-safely"""
        with self.lock:
            return bytes(self.buffer)
    
    def clear(self) -> None:
        """Clear the buffer thread-safely"""
        with self.lock:
            self.buffer = bytearray()

class TranscriptionWorker:
    def __init__(self):
        self.running = True
        self.temp_file_path = None
        
        # Create a temporary file that we'll reuse
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
            self.temp_file_path = temp_file.name
        
        # Start the worker thread
        self.thread = threading.Thread(target=self._process_queue)
        self.thread.daemon = True
        self.thread.start()
    
    def _process_queue(self):
        """Process transcription requests from the queue"""
        while self.running:
            try:
                # Get a task from the queue
                task = transcription_queue.get(timeout=1.0)
                if task is None:
                    continue
                
                task_id, audio_data, language, prompt, is_final = task
                
                # Write to temporary file
                with sf.SoundFile(self.temp_file_path, 'w', 16000, 1, 'PCM_16') as f:
                    f.write(np.frombuffer(audio_data, dtype=np.int16))
                
                # Transcribe with appropriate settings
                if is_final:
                    # Accurate mode for final results
                    segments, info = model.transcribe(
                        self.temp_file_path, 
                        beam_size=5,
                        language=language,
                        initial_prompt=prompt,
                        condition_on_previous_text=True
                    )
                else:
                    # Fast mode for interim results
                    segments, info = model.transcribe(
                        self.temp_file_path, 
                        beam_size=2,
                        temperature=0.0,
                        vad_filter=True,
                        vad_parameters=dict(min_silence_duration_ms=300),
                        condition_on_previous_text=True,
                        initial_prompt=prompt,
                        language=language
                    )
                
                # Put the result in the results queue
                results_queue.put((task_id, segments, info, is_final))
                
                # Mark the task as done
                transcription_queue.task_done()
                
            except Exception as e:
                print(f"Error in transcription worker: {str(e)}")
    
    def stop(self):
        """Stop the worker thread"""
        self.running = False
        if self.thread.is_alive():
            self.thread.join(timeout=2.0)
        
        # Clean up temp file
        if self.temp_file_path and os.path.exists(self.temp_file_path):
            try:
                os.unlink(self.temp_file_path)
            except:
                pass

# Start the transcription worker
transcription_worker = TranscriptionWorker()

@app.websocket("/ws/stt")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    
    # Create an audio buffer and context manager
    audio_buffer = AudioBuffer(max_size_seconds=60)
    context_manager = ContextManager(max_context_length=150)
    
    try:
        last_process_time = time.time()
        last_activity_time = time.time()
        last_sent_text = ""
        task_counter = 0
        pending_tasks = {}
        
        while True:
            # Send keepalive ping every 30 seconds to prevent timeout
            current_time = time.time()
            if current_time - last_activity_time > 30:
                try:
                    await websocket.send_text(json.dumps({"keepalive": True}))
                    last_activity_time = current_time
                except Exception as e:
                    print(f"Error sending keepalive: {str(e)}")
                    break
            
            # Check for completed transcriptions
            while not results_queue.empty():
                try:
                    task_id, segments, info, is_final = results_queue.get_nowait()
                    
                    # Check if this is one of our tasks
                    if task_id in pending_tasks:
                        # Update language if needed
                        if info.language:
                            context_manager.update_language(info.language, info.language_probability)
                        
                        # Update context with new segments
                        transcript = context_manager.update_context(segments, is_final=is_final)
                        
                        # Check for subtle breaks (punctuation or natural pauses)
                        has_subtle = False
                        if transcript and len(transcript) > len(last_sent_text):
                            # Check if there's a new sentence ending
                            for punct in ['.', '!', '?', ',', ';', ':', '。', '！', '？', '，', '；', '：']:
                                if punct in transcript[-20:]:
                                    has_subtle = True
                                    break
                        
                        # Send the result to the client
                        if transcript != last_sent_text:
                            await manager.send_text(json.dumps({
                                "transcript": transcript,
                                "language": str(context_manager.get_language()) if context_manager.get_language() else "unknown",
                                "language_probability": float(context_manager.get_language_probability()),
                                "is_final": is_final,
                                "is_subtle": has_subtle
                            }), websocket)
                            last_sent_text = transcript
                        
                        # Remove from pending tasks
                        del pending_tasks[task_id]
                except Exception as e:
                    print(f"Error processing result: {str(e)}")
            
            # Receive audio data with timeout to allow for keepalive checks
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=0.1)
                last_activity_time = time.time()  # Update activity time
            except asyncio.TimeoutError:
                # No data received, continue to next iteration
                await asyncio.sleep(0.01)  # Small sleep to prevent CPU spinning
                continue
            except Exception as e:
                print(f"Error receiving data: {str(e)}")
                break
            
            try:
                # Parse the JSON data
                json_data = json.loads(data)
                
                # Handle keepalive response
                if json_data.get("keepalive_response", False):
                    continue
                
                audio_data = json_data.get("audio")
                
                # Check if this is the end of streaming
                if "end" in json_data and json_data.get("end") == True:
                    # Process the complete audio buffer for final result
                    task_id = f"final_{task_counter}"
                    task_counter += 1
                    
                    # Add to pending tasks
                    pending_tasks[task_id] = True
                    
                    # Queue the transcription task
                    transcription_queue.put((
                        task_id,
                        audio_buffer.get_full(),
                        context_manager.get_language(),
                        None,  # No prompt for final
                        True   # is_final
                    ))
                    
                    # Wait for the final result
                    max_wait = 10.0  # Maximum wait time in seconds
                    wait_start = time.time()
                    while task_id in pending_tasks and time.time() - wait_start < max_wait:
                        await asyncio.sleep(0.1)
                    
                    # Reset for next session
                    audio_buffer.clear()
                    last_sent_text = ""
                    continue
                
                if not audio_data:
                    continue
                
                # Decode base64 audio data
                audio_bytes = base64.b64decode(audio_data)
                
                # Add to our audio buffer
                audio_buffer.add_audio(audio_bytes)
                
                # Process interim results at regular intervals
                current_time = time.time()
                if current_time - last_process_time >= 0.5:  # Process every 0.5 seconds
                    # Get a 10-second window of audio
                    window_audio = audio_buffer.get_window(window_size_seconds=10)
                    
                    # Create a task ID
                    task_id = f"interim_{task_counter}"
                    task_counter += 1
                    
                    # Add to pending tasks
                    pending_tasks[task_id] = True
                    
                    # Queue the transcription task
                    transcription_queue.put((
                        task_id,
                        window_audio,
                        context_manager.get_language(),
                        context_manager.get_prompt(),
                        False  # not final
                    ))
                    
                    last_process_time = current_time
            
            except Exception as e:
                print(f"Error processing message: {str(e)}")
        
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/")
async def root():
    return {"message": "OnlySaid Speech-to-Text API is running. Connect to /ws/stt for real-time transcription."}

@app.on_event("shutdown")
async def shutdown_event():
    # Stop the transcription worker
    transcription_worker.stop()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=36430, reload=True)