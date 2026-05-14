  const jarvisCircle = document.getElementById('jarvisCircle');
        const statusDisplay = document.getElementById('statusDisplay');
        const startTrigger = document.getElementById('startTrigger');

        let chatHistory = [];
        const synth = window.speechSynthesis;
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = SpeechRecognition ? new SpeechRecognition() : null;

        let systemActive = false; // Tracks if "Hey Jarvis" wake word has activated the assistant

        if (recognition) {
            recognition.continuous = true; // Loops automatically to keep listening
            recognition.interimResults = false;
            recognition.lang = 'en-US'; // Change to 'ur-PK' or 'hi-IN' for Urdu/Hindi support if required

            // Updates the UI state classes seamlessly
            function setVisualState(state) {
                jarvisCircle.className = 'jarvis-circle'; // resets
                if (state === 'idle') {
                    jarvisCircle.classList.add('circle-idle');
                    statusDisplay.innerText = systemActive ? 'Listening...' : 'Say "Hey Jarvis"';
                    statusDisplay.className = "text-cyan-400 font-medium text-lg mt-1 tracking-wide";
                } else if (state === 'listening') {
                    jarvisCircle.classList.add('circle-listening');
                    statusDisplay.innerText = 'Hearing you...';
                    statusDisplay.className = "text-emerald-400 font-medium text-lg mt-1 tracking-wide";
                } else if (state === 'processing') {
                    jarvisCircle.classList.add('circle-speaking');
                    statusDisplay.innerText = 'Jarvis is processing...';
                    statusDisplay.className = "text-purple-400 font-medium text-lg mt-1 tracking-wide animate-pulse";
                }
            }

            recognition.onstart = () => {
                console.log("Speech recognition operational.");
                setVisualState('idle');
            };

            recognition.onresult = async (event) => {
                const lastResultIndex = event.results.length - 1;
                const transcript = event.results[lastResultIndex][0].transcript.trim().toLowerCase();
                console.log("Heard:", transcript);

                // Wake word logic: "Hey Jarvis"
                if (!systemActive) {
                    if (transcript.includes('hey jarvis') || transcript.includes('jarvis')) {
                        systemActive = true;
                        synth.cancel(); // Stop any pending speech

                        // Initial welcome audio trigger
                        speakText("Yes sir, Jarvis online. How can I help you?");
                    }
                    return;
                }

                // If user says "stop" or "go to sleep", deactivate active mode
                if (transcript === 'stop' || transcript === 'go to sleep' || transcript === 'exit') {
                    systemActive = false;
                    speakText("Going to standby mode.");
                    return;
                }

                // If assistant is active and text is captured, process with server backend
                if (transcript.length > 1) {
                    recognition.stop(); // Pause engine so it doesn't process its own AI audio output
                    setVisualState('processing');

                    try {
                        const response = await fetch('https://voice-ai-backend-ashy.vercel.app/chat', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ message: transcript, history: chatHistory })
                        });

                        if (!response.ok) throw new Error("Network latency or server breakdown.");

                        const data = await response.json();

                        // Sync history
                        chatHistory.push({ role: 'user', content: transcript });
                        chatHistory.push({ role: 'assistant', content: data.text });

                        // Speak AI output text
                        speakText(data.speech || data.text);

                    } catch (err) {
                        console.error(err);
                        speakText("System connection error. Please verify backend state.");
                    }
                }
            };

            function speakText(textToSpeak) {
                setVisualState('processing');
                const utterance = new SpeechSynthesisUtterance(textToSpeak);

                utterance.onend = () => {
                    // Once speech completes, safely resume microphone parsing loop
                    setVisualState('idle');
                    try { recognition.start(); } catch (e) { }
                };

                utterance.onerror = () => {
                    setVisualState('idle');
                    try { recognition.start(); } catch (e) { }
                };

                synth.speak(utterance);
            }

            // Fallback restarts loop safely if standard Web Speech API drops link
            recognition.onend = () => {
                if (!synth.speaking) {
                    try { recognition.start(); } catch (e) { }
                }
            };

            // Start microphone capturing stream automatically
            window.addEventListener('DOMContentLoaded', () => {
                recognition.start();
            });

            // Fallback screen tap to trigger microphone initialization in browsers requiring explicit gestures
            startTrigger.addEventListener('click', () => {
                synth.cancel();
                systemActive = true;
                speakText("Jarvis activated via interface command.");
            });

        } else {
            statusDisplay.innerText = "Speech Processing API Missing";
            statusDisplay.className = "text-red-500 font-semibold";
        }