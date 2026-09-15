import { useState, useEffect, useRef, useCallback } from 'react';
import { soundEngine } from '../services/soundEffects';

interface UseJarvisVoiceOptions {
  onCommandDetected?: (command: string) => void;
}

export function useJarvisVoice({ onCommandDetected }: UseJarvisVoiceOptions = {}) {
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  const [interimText, setInterimText] = useState<string>('');
  const [isSupported, setIsSupported] = useState<boolean>(true);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const jarvisVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const isMutedRef = useRef<boolean>(isMuted);

  isMutedRef.current = isMuted;

  // Initialize Speech Synthesis and find best British voice
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;

      const pickVoice = () => {
        const voices = synthRef.current?.getVoices() || [];
        // Priority: British English male/authoritative (JARVIS style)
        const britishMale = voices.find(
          v =>
            (v.lang === 'en-GB' || v.lang.startsWith('en-GB')) &&
            (v.name.toLowerCase().includes('george') ||
              v.name.toLowerCase().includes('male') ||
              v.name.toLowerCase().includes('daniel') ||
              v.name.toLowerCase().includes('ryan') ||
              v.name.toLowerCase().includes('uk english'))
        );

        const anyBritish = voices.find(v => v.lang.includes('GB') || v.lang.includes('gb'));
        const anyEnglish = voices.find(v => v.lang.startsWith('en'));

        jarvisVoiceRef.current = britishMale || anyBritish || anyEnglish || voices[0] || null;
      };

      pickVoice();
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = pickVoice;
      }
    }
  }, []);

  // Initialize Speech Recognition (Web Speech API / Whisper bridge compatible)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      console.warn('[JarvisVoice] SpeechRecognition API not natively available in browser.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        if (isMutedRef.current) return;

        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            final += item[0].transcript;
          } else {
            interim += item[0].transcript;
          }
        }

        if (interim) {
          setInterimText(interim);
        }

        if (final.trim()) {
          const cleaned = final.trim();
          setTranscript(cleaned);
          setInterimText('');
          console.log('[JarvisVoice] Voice Command Captured:', cleaned);
          if (onCommandDetected) {
            onCommandDetected(cleaned);
          }
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          console.warn('[JarvisVoice] Recognition note:', event.error);
        }
      };

      recognition.onend = () => {
        // Auto-restart if not muted to keep continuous standby listening
        if (!isMutedRef.current && recognitionRef.current) {
          try {
            recognition.start();
          } catch (e) {
            // Already started or restarting
          }
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;

      // Start listening on initialization if not muted
      try {
        recognition.start();
      } catch (e) {
        console.warn('[JarvisVoice] Autostart notice:', e);
      }
    } catch (err) {
      console.error('[JarvisVoice] Init error:', err);
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, [onCommandDetected]);

  // Toggle Mute / Unmute
  const toggleMute = useCallback(() => {
    soundEngine.playClick();
    setIsMuted(prev => {
      const next = !prev;
      if (next) {
        // Muting
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch (e) {}
        }
        setIsListening(false);
        setInterimText('');
      } else {
        // Unmuting
        if (recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {}
        }
        setIsListening(true);
      }
      return next;
    });
  }, []);

  // Text-to-Speech speaking function
  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (typeof window === 'undefined' || !synthRef.current) return;

    // Clean markdown tags or action tags before speaking
    const cleanText = text
      .replace(/\[ACTION:[^\]]+\]/g, '')
      .replace(/[*_#`~]/g, '')
      .trim();

    if (!cleanText) return;

    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    if (jarvisVoiceRef.current) {
      utterance.voice = jarvisVoiceRef.current;
    }
    utterance.rate = 1.05; // Calm, crisp, rapid tactical cadence
    utterance.pitch = 0.95; // Slightly deeper, authoritative tone

    let checkInterval: any = null;

    utterance.onstart = () => {
      setIsSpeaking(true);
      checkInterval = setInterval(() => {
        if (!synthRef.current?.speaking) {
          setIsSpeaking(false);
          clearInterval(checkInterval);
        }
      }, 200);
    };

    utterance.onend = () => {
      if (checkInterval) clearInterval(checkInterval);
      setIsSpeaking(false);
      if (onEnd) onEnd();
    };

    utterance.onerror = () => {
      if (checkInterval) clearInterval(checkInterval);
      setIsSpeaking(false);
    };

    synthRef.current.speak(utterance);
  }, []);

  // Stop any ongoing speech
  const stopSpeaking = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setIsSpeaking(false);
  }, []);

  return {
    isMuted,
    isListening,
    isSpeaking,
    transcript,
    interimText,
    isSupported,
    toggleMute,
    speak,
    stopSpeaking,
    setTranscript
  };
}
