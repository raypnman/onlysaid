import asyncio
import base64
import json
import websockets
import pyaudio
import signal
import os
import time
import sys
import re

# Audio recording parameters
FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 16000
CHUNK = 1024

# Global flags
running = True

def signal_handler(sig, frame):
    global running
    print("\nStopping... (Ctrl+C pressed)")
    running = False

class AudioRecorder:
    def __init__(self):
        self.audio = pyaudio.PyAudio()
        self.stream = None
        self.is_recording = False
        
    def start_recording(self):
        if self.stream is None:
            self.stream = self.audio.open(
                format=FORMAT, 
                channels=CHANNELS, 
                rate=RATE, 
                input=True, 
                frames_per_buffer=CHUNK
            )
        self.is_recording = True
        return self.stream
    
    def stop_recording(self):
        self.is_recording = False
        
    def cleanup(self):
        if self.stream:
            self.stream.stop_stream()
            self.stream.close()
        self.audio.terminate()

async def get_input():
    """Get user input asynchronously"""
    return await asyncio.get_event_loop().run_in_executor(None, input)

class TranscriptDisplay:
    def __init__(self):
        self.current_text = ""
        self.last_subtle_time = time.time()
        self.last_update_time = time.time()
        self.line_length = 0
        self.last_displayed_length = 0
        self.language_switch_detected = False
        
    def detect_language_switch(self, text):
        """Detect if text switches between languages"""
        # Check for English characters
        has_english = bool(re.search(r'[a-zA-Z]', text))
        # Check for Chinese/Japanese/Korean characters
        has_cjk = bool(re.search(r'[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7a3]', text))
        
        # If we have both, it's a language switch
        return has_english and has_cjk
    
    def update(self, transcript, is_final=False, is_subtle=False):
        current_time = time.time()
        
        # Handle final transcript
        if is_final:
            print(f"\n✅ Final: {transcript}")
            return transcript
        
        # Check for language switching
        self.language_switch_detected = self.detect_language_switch(transcript)
        
        # Handle interim results
        if transcript != self.current_text:
            # Check if we should print a new line
            if (is_subtle or 
                current_time - self.last_subtle_time > 2.0 or 
                len(transcript) > len(self.current_text) * 1.5 or
                self.language_switch_detected):
                
                print(f"\n🔊 {transcript}")
                self.last_subtle_time = current_time
                self.last_displayed_length = len(transcript)
            else:
                # Clear the current line and print the updated transcript
                # Calculate how many spaces we need to clear the line
                spaces = max(0, self.last_displayed_length - len(transcript))
                print(f"\r📝 {transcript}" + " " * spaces, end="", flush=True)
                self.last_displayed_length = len(transcript)
            
            self.current_text = transcript
            self.last_update_time = current_time
        
        return self.current_text

async def record_and_stream(websocket, recorder):
    """Record audio and stream to server, displaying real-time transcription"""
    stream = recorder.start_recording()
    
    # Start a background task to listen for the stop command
    stop_task = asyncio.create_task(get_input())
    
    print("\nListening... Press Enter to stop recording")
    print("Transcription will appear in real-time:")
    print("------------------------------------------")
    
    try:
        display = TranscriptDisplay()
        final_transcript = ""
        last_keepalive = time.time()
        
        while recorder.is_recording and running:
            # Check if stop_task is done (user pressed Enter)
            if stop_task.done():
                recorder.stop_recording()
                break
            
            # Send keepalive every 25 seconds
            current_time = time.time()
            if current_time - last_keepalive > 25:
                await websocket.send(json.dumps({"keepalive_response": True}))
                last_keepalive = current_time
            
            # Read audio data
            data = stream.read(CHUNK, exception_on_overflow=False)
            
            # Encode audio chunk to base64
            audio_data = base64.b64encode(data).decode('utf-8')
            
            # Send the audio data to the server
            await websocket.send(json.dumps({"audio": audio_data}))
            
            # Try to receive any available response
            try:
                response = await asyncio.wait_for(websocket.recv(), 0.01)
                result = json.loads(response)
                
                # Handle keepalive ping
                if result.get("keepalive", False):
                    await websocket.send(json.dumps({"keepalive_response": True}))
                    continue
                
                if "transcript" in result:
                    transcript = result["transcript"]
                    is_final = result.get("is_final", False)
                    is_subtle = result.get("is_subtle", False)
                    
                    # Update the display
                    current_text = display.update(transcript, is_final, is_subtle)
                    
                    # If it's the final transcript, save it
                    if is_final:
                        final_transcript = transcript
            except asyncio.TimeoutError:
                # No response yet, continue sending audio
                pass
            except Exception as e:
                print(f"\nWarning: {str(e)}")
                await asyncio.sleep(0.1)
                
        # Send an empty chunk to signal end of streaming
        try:
            await websocket.send(json.dumps({"audio": "", "end": True}))
        except Exception as e:
            print(f"Error sending end signal: {str(e)}")
        
        # Wait for final transcription
        try:
            print("\nFinalizing transcription...")
            response = await asyncio.wait_for(websocket.recv(), 10.0)
            final_result = json.loads(response)
            if "transcript" in final_result:
                final_transcript = final_result["transcript"]
                display.update(final_transcript, is_final=True)
            return final_result
        except asyncio.TimeoutError:
            print("Timeout waiting for final transcription")
            return {
                "transcript": final_transcript,
                "language": "unknown",
                "language_probability": 0.0
            }
        except Exception as e:
            print(f"Error processing final result: {str(e)}")
            return {
                "transcript": final_transcript,
                "language": "unknown",
                "language_probability": 0.0
            }
            
    except Exception as e:
        print(f"Error during recording: {str(e)}")
        return {
            "transcript": display.current_text,
            "language": "unknown",
            "language_probability": 0.0
        }
    finally:
        recorder.stop_recording()

async def save_result(result):
    """Save transcription result to file"""
    if not result:
        print("No transcription result to save")
        return
    
    transcript = result.get("transcript", "")
    language = result.get("language", "unknown")
    probability = float(result.get("language_probability", 0.0))
    
    print("\nFinal transcription:")
    print(transcript)
    print(f"Language: {language} (confidence: {probability:.2f})")
    
    # Save final result to file
    timestamp = int(time.time())
    filename = f"results/result_{timestamp}.txt"
    
    os.makedirs("results", exist_ok=True)
    with open(filename, "w", encoding="utf-8") as f:
        f.write(f"Final Transcription:\n{transcript}\n\n")
        f.write(f"Language: {language} (confidence: {probability:.2f})\n")
    
    print(f"\nResults saved to {filename}")
    return filename

async def test_stt_server():
    global running
    
    # Register signal handler for Ctrl+C
    signal.signal(signal.SIGINT, signal_handler)
    
    # Initialize recorder
    recorder = AudioRecorder()
    
    print("Speech-to-Text Real-Time Streaming Test")
    print("This test shows transcription as you speak in real-time.")
    print("Press Enter to start recording, press Enter again to stop.")
    print("Press Ctrl+C to exit the program completely.")
    
    # Connect to the WebSocket server
    uri = "ws://localhost:36430/ws/stt"
    
    while running:
        try:
            async with websockets.connect(uri, ping_interval=20, ping_timeout=60) as websocket:
                # Send initial connection message
                await websocket.send(json.dumps({"init": True}))
                
                while running:
                    # Wait for user to press Enter to start recording
                    print("\nPress Enter to start recording...")
                    await get_input()
                    if not running:
                        break
                    
                    # Record and stream audio, printing transcription in real-time
                    result = await record_and_stream(websocket, recorder)
                    
                    # Save result to file
                    if result:
                        await save_result(result)
                    
                    # Ask if user wants to continue or exit
                    print("\nContinue with another recording? (y/n): ", end="")
                    response = await get_input()
                    if response.lower() != 'y':
                        running = False
                        break
        
        except websockets.exceptions.ConnectionClosedError as e:
            print(f"\nConnection to server closed: {e}")
            print("Attempting to reconnect in 3 seconds...")
            await asyncio.sleep(3)
            continue
        except Exception as e:
            print(f"\nError: {str(e)}")
            print("Attempting to reconnect in 5 seconds...")
            await asyncio.sleep(5)
            continue
        finally:
            # Only clean up when we're completely done
            if not running:
                recorder.cleanup()
                print("\nProgram terminated")
                break

if __name__ == "__main__":
    try:
        asyncio.run(test_stt_server())
    except KeyboardInterrupt:
        print("\nProgram terminated by user")