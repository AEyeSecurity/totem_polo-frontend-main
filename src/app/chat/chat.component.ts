// chat.component.ts
import { Component, OnInit, ElementRef, ViewChild, AfterViewChecked, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { ChatService, VoiceChatResponse } from './chat.service';
import { FormsModule } from '@angular/forms';

import { LogoutButtonComponent } from '../shared/logout-button/logout-button.component';

interface Message {
  sender: 'user' | 'bot';
  content: string;
  timestamp: Date;
  id: string;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [FormsModule, LogoutButtonComponent],
  template: `
    <div class="chat-wrapper" [class.dark-mode]="isDarkMode">
      <div class="chat-header">
        <div class="header-content">
          <div class="bot-avatar">
            <div class="avatar-icon">P52</div>
            <div class="status-indicator" [class.active]="!isTyping"></div>
          </div>
          <div class="header-info">
            <h2>Asistente Virtual - Parque Industrial Polo 52</h2>
            <p class="status-text">
              {{ isTyping ? 'Escribiendo...' : 'Disponible para consultas' }}
            </p>
          </div>
        </div>
        <div class="header-actions">
          <button
            (click)="toggleTheme()"
            aria-label="Cambiar modo claro/oscuro"
            class="mode-toggle-btn"
            >
            @if (isDarkMode) {
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="feather feather-sun"
                viewBox="0 0 24 24"
                >
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            }
    
            @if (!isDarkMode) {
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="feather feather-moon"
                viewBox="0 0 24 24"
                >
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"></path>
              </svg>
            }
          </button>
          <app-logout-button></app-logout-button>
        </div>
      </div>
    
      <div class="chat-mode-switch">
        <button
          type="button"
          class="mode-pill"
          [class.active]="chatMode === 'voice'"
          (click)="setChatMode('voice')"
          [attr.aria-pressed]="chatMode === 'voice'"
          >
          <span class="material-symbols-outlined">volume_up</span>
          Voz IA
        </button>
        <button
          type="button"
          class="mode-pill"
          [class.active]="chatMode === 'text'"
          (click)="setChatMode('text')"
          [attr.aria-pressed]="chatMode === 'text'"
          >
          <span class="material-symbols-outlined">chat</span>
          Texto
        </button>
      </div>
    
      @if (chatMode === 'text') {
        <div class="chat-container">
          <div class="chat-panel">
            <div class="panel-card messages-card">
              <div class="panel-title">
                <div class="panel-title-icon">
                  <span class="material-symbols-outlined">robot_2</span>
                </div>
                <div>
                  <h3>Chat con POLO Bot</h3>
                  <small>Tu asistente del Parque Industrial POLO 52</small>
                </div>
              </div>
              <div class="chat-messages" #messagesContainer>
                @for (message of messages; track trackByMessageId($index, message)) {
                  <div
                    class="message-wrapper"
                    [class.user-wrapper]="message.sender === 'user'"
                    [class.bot-wrapper]="message.sender === 'bot'"
                    >
                    <div
                      class="message-content"
                  [class]="
                    message.sender === 'user' ? 'user-message' : 'bot-message'
                  "
                      >
                      <div
                        class="message-text"
                        [innerHTML]="formatMessage(message.content)"
                      ></div>
                      <div class="message-time">
                        {{ formatTime(message.timestamp) }}
                      </div>
                    </div>
                  </div>
                }
                @if (isTyping) {
                  <div
                    class="message-wrapper bot-wrapper typing-indicator"
                    >
                    <div class="bot-message typing-message">
                      <div class="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                }
              </div>
            </div>
            <div class="panel-card input-card">
              <div class="chat-input">
                <input
                  #messageInput
                  [(ngModel)]="userMessage"
                  placeholder="Escribe tu consulta..."
                  (keyup.enter)="sendMessage()"
                  [disabled]="isTyping"
                  class="message-input"
                  />
                  <button
                    type="button"
                    (click)="sendMessage()"
                    [disabled]="!userMessage.trim() || isTyping"
                    class="send-button"
                    >
                    @if (!isTyping) {
                      <span class="material-symbols-outlined">
                        send
                      </span>
                    }
                    @if (isTyping) {
                      <span class="loading-text">...</span>
                    }
                  </button>
                </div>
                <div class="input-footer">
                  Presion&aacute; Enter o el bot&oacute;n para enviar tu consulta
                </div>
              </div>
            </div>
            <aside class="sidebar">
              <div class="sidebar-card quick-queries-card">
                <div class="card-header">
                  <span class="material-symbols-outlined">bolt</span>
                  <div>
                    <h3>Consultas R&aacute;pidas</h3>
                    <p>Las preguntas que m&aacute;s recibimos</p>
                  </div>
                </div>
                @for (question of quickQuestions; track question) {
                  <button
                    type="button"
                    class="quick-question"
                    (click)="handleQuickQuestion(question)"
                    [disabled]="isTyping"
                    >
                    <span>{{ question }}</span>
                    <span class="material-symbols-outlined">arrow_forward</span>
                  </button>
                }
              </div>
              <div class="sidebar-card contact-card">
                <div class="card-header">
                  <span class="material-symbols-outlined">support_agent</span>
                  <div>
                    <h3>Conexi&oacute;n Directa</h3>
                    <p>Equipo POLO 52</p>
                  </div>
                </div>
                <ul class="contact-list">
                  <li>
                    <span class="material-symbols-outlined">call</span>
                    <div>
                      <strong>+54 351 123-4567</strong>
                      <small>Atenci&oacute;n comercial</small>
                    </div>
                  </li>
                  <li>
                    <span class="material-symbols-outlined">mail</span>
                    <div>
                      <strong>info&#64;polo52.com</strong>
                      <small>Contacto general</small>
                    </div>
                  </li>
                  <li>
                    <span class="material-symbols-outlined">schedule</span>
                    <div>
                      <strong>24/7 Disponible</strong>
                      <small>Siempre listos para ayudarte</small>
                    </div>
                  </li>
                </ul>
              </div>
            </aside>
          </div>
        } @else {
          <section class="voice-experience">
            <div class="voice-hero">
              <div class="voice-hero-header">
                <div>
                  <p class="tag-label">POLO BOT</p>
                  <h3>Habla con nuestro asistente por voz</h3>
                </div>
              </div>
              <div class="voice-stage">
                <div
                  class="speech-bubble user-bubble"
                  [class.filled]="voiceUserText"
                  [class.typing]="voiceUserTyping"
                  >
                  <span class="bubble-label">Tu consulta</span>
                  <p aria-live="polite">
                    {{
                    voiceUserText ||
                    'Toca el microfono y hablame de lo que necesitas'
                    }}
                  </p>
                </div>
                <div class="robot-figure">
                  <div class="robot-antenna-set">
                    <span class="antenna antenna-left"></span>
                    <span class="antenna antenna-center"></span>
                    <span class="antenna antenna-right"></span>
                  </div>
                  <div class="robot-head" [class.talking]="isBotSpeaking">
                    <span class="head-screw screw-top-left"></span>
                    <span class="head-screw screw-top-right"></span>
                    <span class="head-screw screw-bottom-left"></span>
                    <span class="head-screw screw-bottom-right"></span>
                    <div class="head-ear ear-left"></div>
                    <div class="head-ear ear-right"></div>
                    <div class="robot-eyes">
                      <div class="eye eye-left">
                        <span class="pupil"></span>
                        <span class="shine"></span>
                      </div>
                      <div class="eye eye-right">
                        <span class="pupil"></span>
                        <span class="shine"></span>
                      </div>
                    </div>
                    <div
                      class="robot-smile"
                      [class.talking]="isBotSpeaking"
                    ></div>
                  </div>
                  <div class="robot-neck"></div>
                  <div class="robot-body">
                    <div class="body-plate">
                      <div class="logo-box" aria-label="Logo Polo 52"></div>
                    </div>
                    <div class="robot-arm arm-left">
                      <span class="arm-joint"></span>
                      <span class="hand"></span>
                    </div>
                    <div class="robot-arm arm-right">
                      <span class="arm-joint"></span>
                      <span class="hand"></span>
                    </div>
                  </div>
                  <div class="robot-legs">
                    <div class="leg leg-left">
                      <span class="leg-knee"></span>
                      <span class="foot"></span>
                    </div>
                    <div class="leg leg-right">
                      <span class="leg-knee"></span>
                      <span class="foot"></span>
                    </div>
                  </div>
                </div>
                <div
                  class="speech-bubble bot-bubble"
                  [class.filled]="voiceBotText"
                  [class.typing]="voiceBotTyping"
                  >
                  <span class="bubble-label">Respuesta del bot</span>
                  <p aria-live="polite">
                    {{
                    voiceBotText ||
                    'Aca aparecera mi respuesta automatica para que la leas mientras la escuchas.'
                    }}
                  </p>
                </div>
              </div>
              <div class="voice-controls">
                <button
                  type="button"
                  class="mic-button"
                  [class.is-recording]="isRecording"
                  (click)="toggleRecording()"
                [disabled]="
                  !supportsVoice || (isProcessingVoice && !isRecording)
                "
                  [attr.aria-pressed]="isRecording"
                  >
                  <span class="material-symbols-outlined">
                    {{ isRecording ? 'stop_circle' : 'mic' }}
                  </span>
                </button>
                <p class="mic-helper">{{ voiceHelperText }}</p>
                <div class="voice-status">
                  @if (isRecording) {
                    <span>Escuchando tu consulta...</span>
                  }
                  @if (!isRecording && isProcessingVoice) {
                    <span
                      >Generando respuesta...</span
                      >
                  }
                </div>
                @if (voiceError) {
                  <p class="voice-error">{{ voiceError }}</p>
                }
              </div>
            </div>
          </section>
        }
    
      </div>
    `,

  styleUrl: './chat.component.css',
})
export class ChatbotComponent implements OnInit, AfterViewChecked, OnDestroy {
  private chatService = inject(ChatService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef;

  messages: Message[] = [];
  userMessage = '';
  isTyping = false;
  isDarkMode = false;
  quickQuestions: string[] = [];
  chatMode: 'text' | 'voice' = 'text';
  isRecording = false;
  isProcessingVoice = false;
  supportsVoice =
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof MediaRecorder !== 'undefined';
  voiceError: string | null = null;
  voiceUserText = '';
  voiceBotText = '';
  voiceUserTyping = false;
  voiceBotTyping = false;
  isBotSpeaking = false;
  private readonly defaultQuickQuestions = [
    'Disponibilidad de lotes',
    'Empresas instaladas en el parque',
    'Servicios disponibles',
    'Informacion de contacto',
  ];
  private readonly popularQuestionsKey = 'chatPopularQueries';
  private questionStats: Record<string, { count: number; display: string }> =
    {};

  private shouldScrollToBottom = false;
  private mediaRecorder?: MediaRecorder;
  private audioChunks: Blob[] = [];
  private shouldDiscardRecording = false;
  private activeStream?: MediaStream;
  private userBubbleInterval?: number;
  private botBubbleInterval?: number;
  private userBubbleTypingTimeout?: number;
  private botBubbleTypingTimeout?: number;
  private speechRecognition: any = null;
  private botStreamController?: AbortController;

  constructor() {
    if (!this.supportsVoice) {
      this.voiceError = 'Tu navegador no soporta la experiencia de voz.';
    }
  }

  ngOnInit() {
    const savedTheme = localStorage.getItem('chatTheme');
    this.isDarkMode = savedTheme === 'dark';
    this.loadPopularQuestions();
    this.addBotMessage(
      'Bienvenido al Parque Industrial POLO 52.\n\nMi nombre es POLO y estoy aqu\u00ed para ayudarte con consultas sobre las empresas y servicios disponibles en el parque. \u00bfEn qu\u00e9 puedo asistirte?'
    );
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy() {
    this.stopBubbleTyping('user');
    this.stopBubbleTyping('bot');
    this.stopRecording(true);
    this.cleanupMediaStream();
  }

  get voiceHelperText(): string {
    if (!this.supportsVoice) {
      return 'Tu navegador no soporta la experiencia de voz.';
    }

    if (this.isRecording) {
      return 'Estamos escuchando tu consulta...';
    }

    if (this.isProcessingVoice) {
      return 'Generando la respuesta con IA...';
    }

    return 'Toca el microfono para hablar con POLO Bot.';
  }

  setChatMode(mode: 'text' | 'voice') {
    if (this.chatMode === mode) return;
    this.chatMode = mode;
    if (mode === 'text' && this.isRecording) {
      this.stopRecording(true);
    }
    if (mode === 'text') {
      this.stopBubbleTyping('user');
      this.stopBubbleTyping('bot');
    }
    if (mode === 'voice') {
      this.voiceError = this.supportsVoice
        ? null
        : 'Tu navegador no soporta la experiencia de voz.';
    }
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('chatTheme', this.isDarkMode ? 'dark' : 'light');
  }

  toggleRecording() {
    if (!this.supportsVoice) {
      this.voiceError = 'Tu dispositivo no permite usar el microfono.';
      this.typeFinalBubbleText(
        'user',
        'Tu dispositivo no permite usar el microfono.'
      );
      this.stopBubbleTyping('bot');
      return;
    }

    if (this.isRecording) {
      this.stopRecording();
    } else if (!this.isProcessingVoice) {
      this.startRecording();
    }
  }

  handleQuickQuestion(question: string) {
    if (this.isTyping) return;
    this.userMessage = question;
    this.sendMessage();
  }

  trackByMessageId(index: number, message: Message): string {
    return message.id;
  }

  private generateMessageId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  private addUserMessage(content: string) {
    this.messages.push({
      sender: 'user',
      content,
      timestamp: new Date(),
      id: this.generateMessageId(),
    });
    this.syncVoiceBubble('user', content);
    this.shouldScrollToBottom = true;
    this.registerQuestion(content);
  }

  private addBotMessage(content: string) {
    this.messages.push({
      sender: 'bot',
      content,
      timestamp: new Date(),
      id: this.generateMessageId(),
    });
    this.syncVoiceBubble('bot', content);
    this.shouldScrollToBottom = true;
  }

  private scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        const element = this.messagesContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }

  formatMessage(content: string): string {
    return content.replace(/\n/g, '<br>');
  }

  formatTime(timestamp: Date): string {
    return timestamp.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private getChatHistory(): { user: string; assistant: string }[] {
    const history: { user: string; assistant: string }[] = [];
    let lastUserMessage: string | null = null;

    for (const message of this.messages) {
      if (message.sender === 'user') lastUserMessage = message.content;
      else if (message.sender === 'bot' && lastUserMessage) {
        history.push({ user: lastUserMessage, assistant: message.content });
        lastUserMessage = null;
      }
    }
    return history;
  }

  private loadPopularQuestions() {
    try {
      const stored = localStorage.getItem(this.popularQuestionsKey);
      if (stored) this.questionStats = JSON.parse(stored);
    } catch (error) {
      console.warn('No se pudieron cargar las consultas populares:', error);
      this.questionStats = {};
    }
    this.updateQuickQuestions();
  }

  private savePopularQuestions() {
    try {
      localStorage.setItem(
        this.popularQuestionsKey,
        JSON.stringify(this.questionStats)
      );
    } catch (error) {
      console.warn('No se pudieron guardar las consultas populares:', error);
    }
  }

  private updateQuickQuestions() {
    const stats = Object.values(this.questionStats)
      .filter((item) => item.count >= 2)
      .sort((a, b) => b.count - a.count);

    const top = stats.slice(0, 4).map((item) => item.display);

    if (top.length < 4) {
      const remainingDefaults = this.defaultQuickQuestions.filter(
        (question) => !top.includes(question)
      );
      this.quickQuestions = [...top, ...remainingDefaults].slice(0, 4);
    } else {
      this.quickQuestions = top;
    }
  }

  private registerQuestion(content: string) {
    const normalized = content.trim().toLowerCase();
    if (!normalized) return;

    if (this.questionStats[normalized]) {
      this.questionStats[normalized].count++;
      this.questionStats[normalized].display = content.trim();
    } else {
      this.questionStats[normalized] = { count: 1, display: content.trim() };
    }

    this.savePopularQuestions();
    this.updateQuickQuestions();
  }

  async sendMessage() {
    if (!this.userMessage.trim() || this.isTyping) return;

    const messageToSend = this.userMessage.trim();
    this.addUserMessage(messageToSend);
    this.userMessage = '';
    this.isTyping = true;

    const initialDelay = Math.min(300 + messageToSend.length * 10, 800);

    setTimeout(() => {
      const history = this.getChatHistory();

      this.chatService.sendMessage(messageToSend, history).subscribe({
        next: (resp: VoiceChatResponse) => {
          const text = resp?.data?.text || 'Respuesta invalida.';
          this.simulateTyping(text);

          const b64 = resp?.data?.audio_base64;
          if (b64) {
            const audio = new Audio(`data:audio/mpeg;base64,${b64}`);
            audio.play().catch(console.error);
          }
        },
        error: (error) => {
          console.error('Error en la solicitud:', error);
          const msg =
            error.status === 0
              ? 'No se pudo conectar con el servidor. Verifique la conexion.'
              : error.status >= 500
              ? 'El servidor esta experimentando problemas. Intente mas tarde.'
              : 'Lo siento, hubo un problema tecnico. Por favor, intente nuevamente.';
          this.simulateTyping(msg);
        },
      });
    }, initialDelay);

    setTimeout(() => {
      if (this.messageInput) this.messageInput.nativeElement.focus();
    }, 100);
  }

  private simulateTyping(message: string) {
    const botMessage: Message = {
      sender: 'bot',
      content: '',
      timestamp: new Date(),
      id: this.generateMessageId(),
    };

    this.messages.push(botMessage);
    this.shouldScrollToBottom = true;

    let currentIndex = 0;
    const characters = message.split('');

    const typeCharacter = () => {
      if (currentIndex < characters.length) {
        botMessage.content += characters[currentIndex];
        this.shouldScrollToBottom = true;
        currentIndex++;

        let delay = 25;
        if (['.', '!'].includes(characters[currentIndex - 1])) delay = 100;
        else if ([',', ':'].includes(characters[currentIndex - 1])) delay = 50;
        else if (characters[currentIndex - 1] === ' ') delay = 15;
        else delay = Math.random() * 20 + 15;

        setTimeout(typeCharacter, delay);
      } else {
        this.isTyping = false;
      }
    };

    setTimeout(typeCharacter, 100);
  }

  private startBubbleTyping(target: 'user' | 'bot', placeholder: string) {
    const clean = placeholder?.trim();
    if (!clean) return;

    this.stopBubbleTyping(target);
    this.setTypingFlag(target, true);
    this.setBubbleText(target, '');

    const loopText = `${clean}   `;
    let index = 1;

    const intervalId = setInterval(() => {
      this.setBubbleText(target, loopText.slice(0, index));
      index++;
      if (index > loopText.length) {
        index = 1;
      }
    }, 80) as unknown as number;

    if (target === 'user') this.userBubbleInterval = intervalId;
    else this.botBubbleInterval = intervalId;
  }

  private stopBubbleTyping(target: 'user' | 'bot', keepTypingFlag = false) {
    if (target === 'user') {
      if (this.userBubbleInterval) {
        clearInterval(this.userBubbleInterval);
        this.userBubbleInterval = undefined;
      }
      if (this.userBubbleTypingTimeout) {
        clearTimeout(this.userBubbleTypingTimeout);
        this.userBubbleTypingTimeout = undefined;
      }
      if (!keepTypingFlag) this.voiceUserTyping = false;
    } else {
      if (this.botBubbleInterval) {
        clearInterval(this.botBubbleInterval);
        this.botBubbleInterval = undefined;
      }
      if (this.botBubbleTypingTimeout) {
        clearTimeout(this.botBubbleTypingTimeout);
        this.botBubbleTypingTimeout = undefined;
      }
      if (!keepTypingFlag) this.voiceBotTyping = false;
    }
  }

  private typeFinalBubbleText(target: 'user' | 'bot', text: string) {
    const content = text ?? '';
    this.stopBubbleTyping(target, true);
    this.setTypingFlag(target, true);

    const characters = Array.from(content);
    if (!characters.length) {
      this.setBubbleText(target, content);
      this.setTypingFlag(target, false);
      return;
    }

    this.setBubbleText(target, '');
    let index = 0;

    const typeNext = () => {
      this.setBubbleText(target, characters.slice(0, index + 1).join(''));
      index++;

      if (index < characters.length) {
        const delay =
          characters[index - 1] === ' ' ? 20 : 40 + Math.random() * 35;
        const timeoutId = setTimeout(typeNext, delay) as unknown as number;
        if (target === 'user') this.userBubbleTypingTimeout = timeoutId;
        else this.botBubbleTypingTimeout = timeoutId;
      } else {
        this.setTypingFlag(target, false);
      }
    };

    typeNext();
  }

  private setBubbleText(target: 'user' | 'bot', value: string) {
    if (target === 'user') this.voiceUserText = value;
    else this.voiceBotText = value;
  }

  private setTypingFlag(target: 'user' | 'bot', value: boolean) {
    if (target === 'user') this.voiceUserTyping = value;
    else this.voiceBotTyping = value;
  }

  private syncVoiceBubble(target: 'user' | 'bot', text: string) {
    this.stopBubbleTyping(target);
    this.setTypingFlag(target, false);
    this.setBubbleText(target, text ?? '');
  }

  private cancelBotStream() {
    if (this.botStreamController) {
      this.botStreamController.abort();
      this.botStreamController = undefined;
    }
  }

  private startSpeechRecognition() {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (!this.speechRecognition) {
      const rec = new SpeechRecognition();
      rec.lang = 'es-ES';
      rec.interimResults = true;
      rec.continuous = true;

      rec.onresult = (event: any) => {
        let interim = '';
        let finalText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalText += t;
          } else {
            interim += t;
          }
        }
        if (interim) this.syncVoiceBubble('user', interim);
        if (finalText) this.syncVoiceBubble('user', finalText);
      };

      // eslint-disable-next-line @typescript-eslint/no-empty-function -- ignoramos errores de reconocimiento de voz a propósito
      rec.onerror = () => {};
      rec.onend = () => {
        // no-op; el ciclo de vida de la grabación controla el micrófono
      };

      this.speechRecognition = rec;
    }

    try {
      this.speechRecognition.start();
    } catch {
      // ignore restart errors
    }
  }

  private stopSpeechRecognition() {
    if (this.speechRecognition) {
      try {
        this.speechRecognition.stop();
      } catch {
        // ignore
      }
    }
  }

  private async startRecording() {
    this.voiceError = null;
    this.voiceUserText = '';
    this.voiceBotText = '';
    this.cancelBotStream();
    this.stopBubbleTyping('bot');
    this.startBubbleTyping('user', 'Escuchando tu consulta...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.activeStream = stream;
      const mimeType = this.getPreferredMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      this.mediaRecorder = recorder;
      this.audioChunks = [];
      this.shouldDiscardRecording = false;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      recorder.onerror = (event) => {
        console.error('Error en MediaRecorder', event);
        this.voiceError = 'Ocurrio un problema al grabar audio.';
        this.stopRecording(true);
      };

      recorder.onstop = () => {
        const chunks = [...this.audioChunks];
        this.audioChunks = [];
        const discard = this.shouldDiscardRecording;
        this.shouldDiscardRecording = false;
        this.cleanupMediaStream();
        this.mediaRecorder = undefined;

        if (discard || !chunks.length) {
          this.isProcessingVoice = false;
          return;
        }

        this.startBubbleTyping('user', 'Procesando tu consulta...');
        this.isProcessingVoice = true;
        const blob = new Blob(chunks, {
          type: recorder.mimeType || 'audio/webm',
        });
        this.sendAudioBlob(blob);
      };

      recorder.start();
      this.isRecording = true;
      this.startSpeechRecognition();
    } catch (error) {
      console.error('No se pudo iniciar la grabacion', error);
      this.voiceError =
        'No se pudo acceder al microfono. Revisa los permisos del navegador.';
      this.stopBubbleTyping('user');
      this.cleanupMediaStream();
      this.isRecording = false;
    }
  }

  private stopRecording(discard = false) {
    if (!this.mediaRecorder) return;
    this.shouldDiscardRecording = discard;

    if (this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    this.isRecording = false;
    this.stopSpeechRecognition();
    this.cancelBotStream();

    if (discard) {
      this.stopBubbleTyping('user');
      this.stopBubbleTyping('bot');
    }
  }

  private cleanupMediaStream() {
    if (this.activeStream) {
      this.activeStream.getTracks().forEach((track) => track.stop());
      this.activeStream = undefined;
    }
  }

  private getPreferredMimeType(): string | undefined {
    if (typeof MediaRecorder === 'undefined') return undefined;
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4;codecs=mp4a.40.2',
      'audio/mp4',
    ];
    return types.find((type) => MediaRecorder.isTypeSupported(type));
  }

  private sendAudioBlob(blob: Blob) {
    const formData = new FormData();
    const fileExt = blob.type.includes('mp4') ? 'm4a' : 'webm';
    formData.append('audio', blob, `voz-${Date.now()}.${fileExt}`);

    const history = this.getChatHistory();
    if (history.length) {
      formData.append('history_form', JSON.stringify(history));
    }

    this.voiceBotText = '';
    this.startBubbleTyping('bot', 'Generando respuesta con IA...');

    this.chatService.sendAudio(formData).subscribe({
      next: (resp: VoiceChatResponse) => {
        this.isProcessingVoice = false;
        const transcript = resp?.data?.transcript?.trim();
        const botTextRaw = resp?.data?.text;
        const botText = typeof botTextRaw === 'string' ? botTextRaw.trim() : '';

        if (transcript) {
          this.addUserMessage(transcript);
        } else {
          this.syncVoiceBubble('user', 'Consulta enviada con exito.');
        }

        // Fijar siempre texto en burbuja del bot (aunque el audio salga bien)
        this.stopBubbleTyping('bot');
        this.voiceBotTyping = false;
        this.voiceBotText =
          botText ||
          'No pude mostrar el texto, pero ya se reprodujo la respuesta.';
        this.setBubbleText('bot', this.voiceBotText);
        this.cdr.detectChanges();
        if (botText) {
          this.addBotMessage(botText);
        }

        const b64 = resp?.data?.audio_base64;
        if (b64) {
          try {
            const audio = new Audio(`data:audio/mpeg;base64,${b64}`);
            this.isBotSpeaking = true;
            audio.onended = () => {
              this.isBotSpeaking = false;
              this.cdr.detectChanges();
            };
            audio.onerror = () => {
              this.isBotSpeaking = false;
              this.cdr.detectChanges();
            };
            this.isBotSpeaking = true;
            this.cdr.detectChanges();
            audio.play().catch(() => {
              this.isBotSpeaking = false;
              this.cdr.detectChanges();
            });
          } catch {
            this.isBotSpeaking = false;
          }
        } else {
          this.isBotSpeaking = false;
        }
      },
      error: (error) => {
        console.error('Error al enviar audio', error);
        this.isProcessingVoice = false;
        this.voiceError =
          error.status === 0
            ? 'No se pudo conectar con el servidor. Verifica tu conexion.'
            : 'No se pudo procesar el audio. Proba nuevamente en unos segundos.';
        this.cdr.detectChanges();
        this.stopBubbleTyping('bot');
        this.voiceBotTyping = false;
        this.voiceBotText =
          'No pude procesar el audio. Proba nuevamente en unos segundos.';
        this.cdr.detectChanges();
        this.stopBubbleTyping('bot');
        this.voiceBotTyping = false;
        this.syncVoiceBubble('user', 'No pudimos recibir tu consulta.');
        this.isBotSpeaking = false;
        this.cdr.detectChanges();
      },
    });
  }
}

