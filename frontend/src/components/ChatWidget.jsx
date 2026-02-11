import { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Camera, Mic, Image as ImageIcon, Loader2, Volume2, VolumeX, Pause, Play, Video } from 'lucide-react';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, type: 'bot', text: '¡Hola! Soy TecnoBot. Estoy aquí para ayudarte a elegir tu laptop ideal de nuestro catálogo exclusivo. ¿Qué necesitas?' }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState(null);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const audioRef = useRef(new Audio());
  const recognitionRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const fetchInventory = async () => {
        try {
            // Using relative path via Vite Proxy (Check vite.config.js)
            const res = await fetch('/api/computers');
            if (res.ok) {
                const data = await res.json();
                setInventory(data);
                console.log("Inventario cargado:", data);
            } else {
                throw new Error("API Fail");
            }
        } catch (e) {
            console.warn("No se pudo cargar inventario backend, usando fallback.");
            setInventory([
                { brand: "Lenovo", code: "SKU-LAPTOP-let01", price: 1200.00, description: "Lenovo ThinkPad X1 Carbon" },
                { brand: "Asus", code: "SKU-LAPTOP-asu01", price: 1500.00, description: "Asus ROG Strix Gaming" },
                { brand: "Apple", code: "SKU-LAPTOP-mbk01", price: 2000.00, description: "MacBook Pro M1 14ulg" }
            ]);
        }
    };
    fetchInventory();
  }, []);

  const playTextToSpeech = async (text) => {
    if (!text) return;
    try {
        // Stop any current audio first
        if (!audioRef.current.paused) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlayingAudio(false);
        }

        setIsPlayingAudio(true);
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
            method: "POST",
            headers: {
                "Accept": "audio/mpeg",
                "Content-Type": "application/json",
                "xi-api-key": ELEVENLABS_API_KEY
            },
            body: JSON.stringify({
                text: text,
                model_id: "eleven_multilingual_v2",
                voice_settings: { stability: 0.5, similarity_boost: 0.5 }
            })
        });

        if (!response.ok) throw new Error("ElevenLabs Error");
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        audioRef.current.src = audioUrl;
        audioRef.current.play();
        audioRef.current.onended = () => setIsPlayingAudio(false);
    } catch (e) {
        console.error("TTS Error:", e);
        setIsPlayingAudio(false);
    }
  };

  const toggleRecording = () => {
    // If already recording, stop it manually
    if (isRecording && recognitionRef.current) {
        recognitionRef.current.stop();
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Tu navegador no soporta reconocimiento de voz. Usa Chrome/Android o Safari/iOS.");
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'es-ES';
    recognition.interimResults = true; // Enable live typing
    
    setIsRecording(true);
    
    // Capture the text *before* we started speaking so we don't overwrite it
    const baseInput = inputValue; 

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      const newText = (baseInput + (baseInput ? " " : "") + finalTranscript + interimTranscript).trim();
      setInputValue(newText);
    };

    recognition.onerror = (event) => {
      console.error("Mic Error:", event.error);
      if (event.error !== 'no-speech') setIsRecording(false);
      
      if (event.error === 'not-allowed') {
          setIsRecording(false);
          alert("Permiso de micrófono denegado.");
      }
    };

    recognition.onend = () => {
        setIsRecording(false);
        recognitionRef.current = null;
    };
    
    try {
        recognition.start();
    } catch(e) {
        console.error(e);
        setIsRecording(false);
        recognitionRef.current = null;
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const imageUrl = URL.createObjectURL(file);
    addMessage('user', 'Analiza esta imagen', imageUrl);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      // Using relative path via Vite Proxy (Check vite.config.js)
      const backendResponse = await fetch('/api/detect', { method: 'POST', body: formData });
      if (!backendResponse.ok) throw new Error("Error en backend");
      const data = await backendResponse.json();
      const detectedName = data.prediction || "Desconocido";
      const confidence = (data.confidence * 100).toFixed(1);
      
      // LOG SOLICITADO: Imprimir predicción del dataset en consola
      console.log("🔍 Predicción del Modelo (Dataset):", detectedName);

      // Contexto específico para el Agente 2
      const visionContext = `El sistema de visión por computadora ha detectado con confianza del ${confidence}% el producto con código: ${detectedName}.`;
      
      const prompt = `He subido una imagen. ${detectedName !== "Desconocido" ? "Identifica el producto de la imagen." : ""} Quiero saber qué producto es y sus detalles.`;
      
      await callOpenAI(prompt, visionContext);
    } catch (error) {
      console.error(error);
      const errorMsg = 'No pude procesar la imagen. Verifica el servidor.';
      addMessage('bot', errorMsg);
      if(isVoiceEnabled) playTextToSpeech(errorMsg);
    } finally {
      setIsLoading(false);
    }

    // Safety: Stop recording if active to avoid "ghost text" reappearing after clear
    if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
        setIsRecording(false);
    }

  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const videoUrl = URL.createObjectURL(file);
    addMessage('user', 'Analiza este video', null, videoUrl);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      // Backend should handle video processing at this endpoint
      const backendResponse = await fetch('/api/detect_video', { method: 'POST', body: formData });
      if (!backendResponse.ok) throw new Error("Error en backend de video");
      const data = await backendResponse.json();
      const detectedName = data.prediction || "Desconocido";
      const confidence = data.confidence ? (data.confidence * 100).toFixed(1) : "N/A";
      
      // LOG SOLICITADO: Imprimir predicción del dataset en consola
      console.log("🔍 Predicción del Modelo Video:", detectedName);

      // Contexto específico para el Agente 2
      const visionContext = `El sistema de visión por computadora ha detectado con confianza del ${confidence}% el producto con código: ${detectedName} en el video.`;
      
      const prompt = `He subido un video. ${detectedName !== "Desconocido" ? "Identifica el producto." : ""} Quiero saber qué producto es y sus detalles.`;
      
      await callOpenAI(prompt, visionContext);
    } catch (error) {
      console.error(error);
      const errorMsg = 'No pude procesar el video. Verifica el servidor.';
      addMessage('bot', errorMsg);
      if(isVoiceEnabled) playTextToSpeech(errorMsg);
    } finally {
      setIsLoading(false);
    }
    
    if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
        setIsRecording(false);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    const userText = inputValue;
    setInputValue("");
    addMessage('user', userText);
    setIsLoading(true);
    try {
      await callOpenAI(userText);
    } catch (error) {
        console.error(error);
        addMessage('bot', 'Error de conexión.');
    } finally {
      setIsLoading(false);
    }
  };

  const callOpenAI = async (promptText, contextData = "") => {
    // === RESTAURACIÓN A OPENAI DIRECTO (Lógica Original) ===
    
    // Aquí definimos el inventario como contexto manualmente en el frontend
    const inventoryContext = inventory.map(p => `- ${p.brand} ${p.description} (Código Oficial: ${p.code}) | Precio: $${p.price}`).join('\n');

    const systemPrompt = `
    Eres 'TecnoBot', el asistente virtual experto de la tienda 'TecnoCuenca'.
    
    INVENTARIO DISPONIBLE (ÚNICAMENTE ESTOS PRODUCTOS):
    ${inventoryContext}

    TUS OBJETIVOS:
    1. Asesorar al cliente basándote EXCLUSIVAMENTE en el inventario de arriba.
    2. Responder de forma natural, amable y en español.
    3. Si preguntan por algo que no está, di que no lo tienes.
    4. Si hay detección visual (contextData), confirma el producto y da detalles.
    `;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini", 
                messages: [
                    { role: "system", content: systemPrompt },
                    ...messages.filter(m => m.type !== 'image').map(m => ({ 
                        role: m.type === 'user' ? 'user' : 'assistant', 
                        content: m.text 
                    })),
                    { role: "user", content: promptText + (contextData ? `\n\n[DATOS DEL SISTEMA DE VISIÓN]: ${contextData}` : "") }
                ],
                max_tokens: 300
            })
        });

        const data = await response.json();
        const botReply = data.choices[0].message.content;
        
        addMessage('bot', botReply);
        
        if (isVoiceEnabled) {
             playTextToSpeech(botReply);
        }
    } catch (error) {
        console.error("OpenAI Error:", error);
        addMessage('bot', 'Error de conexión con OpenAI.');
    }
  };

  /* 
   * LÓGICA ANTERIOR (BACKEND GROQ / LANGCHAIN)
   * Comentada por si se requiere volver a activar para puntos extra
   *
  const callOpenAI = async (promptText, contextData = "") => {
      // ... fetch('/api/chat') ...
  };
  */

  const addMessage = (type, text, image = null) => {
    setMessages(prev => [...prev, { id: Date.now(), type, text, image }]);
  };

  // Helper to render bold text and headings from markdown
  const renderFormattedText = (text) => {
    return text.split('\n').map((paragraph, i) => {
      if (!paragraph.trim()) return <br key={i} className="mb-2" />;
      
      // 1. Manejo de Títulos (### Título)
      if (paragraph.startsWith('### ')) {
          return (
              <h3 key={i} className="font-bold text-blue-700 mt-3 mb-1 text-base border-b border-blue-100 pb-1">
                  {paragraph.replace('### ', '')}
              </h3>
          );
      }

      // 2. Manejo de Listas (- Item)
      if (paragraph.trim().startsWith('- ')) {
          const content = paragraph.trim().substring(2);
          const parts = content.split(/\*\*(.*?)\*\*/g);
          return (
             <div key={i} className="flex gap-2 ml-2 mb-1">
                 <span className="text-blue-500 font-bold">•</span>
                 <p className="flex-1">
                   {parts.map((part, index) => (
                       index % 2 === 1 ? <strong key={index} className="font-bold text-blue-900">{part}</strong> : part
                   ))}
                 </p>
             </div>
          );
      }

      // 3. Párrafo normal con negritas (**texto**)
      const parts = paragraph.split(/\*\*(.*?)\*\*/g);
      
      return (
        <p key={i} className="mb-2 last:mb-0">
          {parts.map((part, index) => (
             index % 2 === 1 ? <strong key={index} className="font-bold text-blue-900">{part}</strong> : part
          ))}
        </p>
      );
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
      {isOpen && (
        <div className="bg-white w-80 md:w-96 h-[550px] rounded-2xl shadow-2xl border border-gray-200 flex flex-col mb-4 pointer-events-auto overflow-hidden animate-slide-up font-sans">
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-4 flex justify-between items-center text-white shadow-md">
            <div className="flex items-center gap-2">
                <div className="bg-white/20 p-1.5 rounded-full backdrop-blur-sm">
                    <MessageSquare className="h-4 w-4 text-white" />
                </div>
                <div>
                    <h3 className="font-bold text-sm">TecnoCuenca AI</h3>
                    <p className="text-xs text-blue-100 flex items-center gap-1">
                        {isPlayingAudio ? "Hablando..." : "En línea"}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-1">
                <button 
                    onClick={() => setIsVoiceEnabled(!isVoiceEnabled)} 
                    className={`p-1.5 rounded hover:bg-white/20 transition-colors ${isVoiceEnabled ? 'text-white' : 'text-blue-200'}`}
                    title={isVoiceEnabled ? "Desactivar voz automática" : "Activar voz automática"}
                >
                    {isVoiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </button>
                <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1.5 rounded transition-colors">
                    <X size={20} />
                </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
            {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm relative group ${
                        msg.type === 'user' 
                        ? 'bg-blue-600 text-white rounded-br-none' 
                        : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none'
                    }`}>
                        {msg.image && (
                            <img src={msg.image} alt="Uploaded" className="w-full h-32 object-cover rounded-lg mb-2" />
                        )}
                        {msg.video && (
                            <video src={msg.video} controls className="w-full h-32 object-cover rounded-lg mb-2" />
                        )}
                        <div className="text-sm leading-relaxed">
                          {msg.type === 'bot' 
                            ? renderFormattedText(msg.text)
                            : <p className="whitespace-pre-wrap">{msg.text}</p>
                          }
                        </div>
                        {/* Stop/Play button for specific message */}
                        {msg.type === 'bot' && (
                            <button 
                                onClick={() => playTextToSpeech(msg.text)}
                                className="absolute -right-10 top-2 p-1.5 bg-gray-100 rounded-full text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm"
                                title="Reproducir respuesta"
                            >
                                <Volume2 size={16} />
                            </button>
                        )}
                    </div>
                </div>
            ))}
            {isLoading && (
                <div className="flex justify-start">
                    <div className="bg-white border border-gray-100 p-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2">
                        <Loader2 className="animate-spin h-4 w-4 text-blue-500" />
                        <span className="text-xs text-gray-500">TecnoBot está escribiendo...</span>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 bg-white border-t border-gray-100">
             <div className="flex items-center gap-2">
                <button 
                    onClick={() => fileInputRef.current.click()}
                    className="p-2 text-gray-400 hover:text-blue-600 transition-colors bg-gray-50 hover:bg-blue-50 rounded-full"
                    title="Enviar imagen"
                >
                    <ImageIcon size={20} />
                </button>
                <button 
                    onClick={() => videoInputRef.current.click()}
                    className="p-2 text-gray-400 hover:text-blue-600 transition-colors bg-gray-50 hover:bg-blue-50 rounded-full"
                    title="Enviar video"
                >
                    <Video size={20} />
                </button>
                <input type="file" ref={videoInputRef} className="hidden" accept="video/*" onChange={handleVideoUpload} />

                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                
                <div className="flex-1 relative">
                    <textarea
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Escribe o usa el micro..."
                        className="w-full bg-gray-100 border-0 rounded-2xl px-4 py-2 pr-10 focus:ring-2 focus:ring-blue-100 focus:outline-none text-sm transition-all resize-none"
                        rows={2}
                    />
                    <button 
                        onClick={toggleRecording}
                        className={`absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-gray-400 hover:text-blue-600'}`}
                        title={isRecording ? "Detener grabación" : "Díctale a la IA"}
                    >
                        {isRecording ? <div className="h-3 w-3 bg-white rounded-sm" /> : <Mic size={16} />}
                    </button>
                </div>

                <button 
                    onClick={handleSend}
                    disabled={!inputValue.trim()}
                    className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                    <Send size={18} />
                </button>
             </div>
             <div className="text-[10px] text-center text-gray-400 mt-2">
                TecnoAI puede cometer errores. Verifica la info.
             </div>
          </div>
        </div>
      )}

      {!isOpen && (
        <button 
            onClick={() => setIsOpen(true)}
            className="group relative bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-all hover:scale-110 pointer-events-auto flex items-center justify-center"
        >
            <MessageSquare size={28} />
            <span className="absolute right-0 top-0 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
        </button>
      )}

      <style>{`
        @keyframes slide-up {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up {
            animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </div>
  );
}
