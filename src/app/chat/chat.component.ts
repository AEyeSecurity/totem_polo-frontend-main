// chat.component.ts
import {
  Component,
  OnInit,
  ElementRef,
  ViewChild,
  AfterViewChecked,
  OnDestroy,
  ChangeDetectorRef,
  NgZone,
  HostListener,
  inject,
} from '@angular/core';
import { ChatService, VoiceChatResponse } from './chat.service';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

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
    <div class="chat-wrapper">
      @if (!isFullscreen) {
        <div class="chat-header">
          <div class="header-content">
            <div class="bot-avatar">
              <div class="avatar-logo-frame">
                <img
                  class="avatar-logo"
                  src="assets/images/PoloLogo-rojo.jpg"
                  alt="Logo Polo 52"
                />
              </div>
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
            @if (showLogout) {
              <app-logout-button></app-logout-button>
            }
            <button
              type="button"
              class="kiosk-toggle"
              (click)="toggleLogoutVisible()"
              aria-label="Mostrar u ocultar cerrar sesion"
            ></button>
          </div>
        </div>
      }

      <div class="chat-mode-switch">
        <button
          type="button"
          class="fullscreen-toggle"
          (click)="toggleFullscreen()"
          [attr.aria-label]="
            isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'
          "
          [attr.title]="
            isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'
          "
        >
          <span class="material-symbols-outlined">
            {{ isFullscreen ? 'fullscreen_exit' : 'fullscreen' }}
          </span>
        </button>
        <div class="mode-pill-group">
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
      </div>

      @if (chatMode === 'text') {
        <div class="chat-container">
          <div class="chat-landing">
            <div
              class="landing-card"
              [class.has-conversation]="hasStartedConversation"
            >
              @if (!hasStartedConversation) {
                <div class="polo-face size-lg">
                  <div class="polo-visor">
                    <span class="polo-eye"></span>
                    <span class="polo-eye"></span>
                  </div>
                </div>
                <h1>Hola, soy POLO</h1>
                <p>&iquest;En qu&eacute; puedo ayudarte hoy?</p>
              } @else {
                <div class="chat-messages" #messagesContainer>
                  @for (
                    message of messages;
                    track trackByMessageId($index, message)
                  ) {
                    <div
                      class="message-wrapper"
                      [class.user-wrapper]="message.sender === 'user'"
                      [class.bot-wrapper]="message.sender === 'bot'"
                    >
                      @if (message.sender === 'bot') {
                        <div class="polo-face size-sm">
                          <div class="polo-visor">
                            <span class="polo-eye"></span>
                            <span class="polo-eye"></span>
                          </div>
                        </div>
                      }
                      <div
                        class="message-content"
                        [class]="
                          message.sender === 'user'
                            ? 'user-message'
                            : 'bot-message'
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
                    <div class="message-wrapper bot-wrapper typing-indicator">
                      <div class="polo-face size-sm">
                        <div class="polo-visor">
                          <span class="polo-eye"></span>
                          <span class="polo-eye"></span>
                        </div>
                      </div>
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
              }
              <div class="landing-input">
                <input
                  #messageInput
                  type="text"
                  inputmode="text"
                  enterkeyhint="send"
                  autocomplete="off"
                  autocorrect="off"
                  [(ngModel)]="userMessage"
                  placeholder="Escribe tu consulta..."
                  (keyup.enter)="sendMessage()"
                  (focus)="onMessageInputFocus()"
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
                    <span class="material-symbols-outlined"> send </span>
                  }
                  @if (isTyping) {
                    <span class="loading-text">...</span>
                  }
                </button>
              </div>
              @if (quickQuestions.length) {
                <div class="landing-suggestions">
                  @for (question of quickQuestions; track question) {
                    <button
                      type="button"
                      class="suggestion-chip"
                      (click)="handleQuickQuestion(question)"
                      [disabled]="isTyping"
                    >
                      {{ question }}
                    </button>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      } @else {
        <section class="voice-experience">
          <div class="voice-hero">
            <div class="voice-hero-header">
              <div>
                <p class="tag-label">POLO BOT</p>
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
              <div class="robot-figure" [class.thinking]="isBotThinking">
                @if (isBotThinking) {
                  <div class="thinking-indicator" aria-hidden="true">
                    <span></span><span></span><span></span>
                  </div>
                }
                <div
                  class="robot-head"
                  [class.talking]="isBotSpeaking"
                  [class.thinking]="isBotThinking"
                >
                  <div class="head-ear ear-left">
                    <span class="ear-accent"></span>
                  </div>
                  <div class="head-ear ear-right">
                    <span class="ear-accent"></span>
                  </div>
                  <div class="robot-face">
                    <div class="robot-eyes">
                      <span class="eye eye-left"></span>
                      <span class="eye eye-right"></span>
                    </div>
                    <div
                      class="robot-smile"
                      [class.talking]="isBotSpeaking"
                    ></div>
                  </div>
                </div>
                <div class="robot-neck"></div>
                <div class="robot-body" [class.talking]="isBotSpeaking">
                  <div
                    class="robot-arm arm-left"
                    [class.talking]="isBotSpeaking"
                  ></div>
                  <div
                    class="robot-arm arm-right"
                    [class.talking]="isBotSpeaking"
                  ></div>
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
                [class.is-starting]="isStartingRecording"
                (click)="toggleRecording()"
                [disabled]="
                  !supportsVoice ||
                  isStartingRecording ||
                  (isProcessingVoice && !isRecording)
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
                  <span>POLO esta pensando...</span>
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
  private ngZone = inject(NgZone);

  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef;

  messages: Message[] = [];
  userMessage = '';
  isTyping = false;
  quickQuestions: string[] = [];
  chatMode: 'text' | 'voice' = 'voice';
  showLogout = false;
  isFullscreen = false;
  isRecording = false;
  isStartingRecording = false;
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

  get isBotThinking(): boolean {
    return this.isProcessingVoice && !this.isBotSpeaking;
  }

  get hasStartedConversation(): boolean {
    return this.messages.some((message) => message.sender === 'user');
  }
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
  private speakingFallbackTimeout?: number;
  private audioContext?: AudioContext;
  private analyserNode?: AnalyserNode;
  private silenceRafId?: number;
  private activeVoiceRequest?: Subscription;

  constructor() {
    if (!this.supportsVoice) {
      this.voiceError = 'Tu navegador no soporta la experiencia de voz.';
    }
  }

  // Duracion de inactividad antes de reiniciar la conversacion: al ser un
  // totem de uso publico, cada recarga o cada pausa larga debe dejar el
  // chat como recien abierto, sin arrastrar la consulta de la persona anterior.
  private readonly idleTimeoutMs = 2 * 60 * 1000;
  private idleTimer?: number;

  ngOnInit() {
    this.loadPopularQuestions();
    this.startFreshConversation();
    this.resetIdleTimer();

    // En pantalla completa el navegador no reacomoda solo la pagina cuando
    // aparece el teclado tactil (si lo hace en modo ventana normal), asi que
    // usamos el Visual Viewport para detectarlo y llevar el input a la vista.
    if (typeof window !== 'undefined' && window.visualViewport) {
      window.visualViewport.addEventListener(
        'resize',
        this.onVisualViewportResize,
      );
    }
  }

  private onVisualViewportResize = (): void => {
    if (!this.isFullscreen) return;
    const input = this.messageInput?.nativeElement;
    if (input && document.activeElement === input) {
      input.scrollIntoView({ block: 'end', behavior: 'smooth' });
    }
  };

  onMessageInputFocus(): void {
    if (!this.isFullscreen) return;
    setTimeout(() => {
      this.messageInput?.nativeElement.scrollIntoView({
        block: 'end',
        behavior: 'smooth',
      });
    }, 50);
  }

  private readonly welcomeMessage =
    'Bienvenido al Parque Industrial POLO 52.\n\nMi nombre es POLO y estoy aqu\u00ed para ayudarte con consultas sobre el parque. \u00bfEn qu\u00e9 puedo asistirte?';

  private startFreshConversation(): void {
    this.messages = [];
    this.addBotMessage(this.welcomeMessage);
  }

  @HostListener('click')
  @HostListener('keydown')
  @HostListener('touchstart')
  onUserActivity(): void {
    this.resetIdleTimer();
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(
      () => this.handleIdleTimeout(),
      this.idleTimeoutMs,
    ) as unknown as number;
  }

  private handleIdleTimeout(): void {
    if (this.hasStartedConversation) {
      this.resetConversation();
    }
    this.resetIdleTimer();
  }

  private resetConversation(): void {
    this.stopRecording(true);
    this.cancelBotStream();
    this.stopBubbleTyping('user');
    this.stopBubbleTyping('bot');
    this.activeVoiceRequest?.unsubscribe();
    this.activeVoiceRequest = undefined;
    this.isProcessingVoice = false;
    this.isBotSpeaking = false;
    this.voiceUserText = '';
    this.voiceBotText = '';
    this.voiceError = this.supportsVoice
      ? null
      : 'Tu navegador no soporta la experiencia de voz.';

    this.userMessage = '';
    this.isTyping = false;
    this.startFreshConversation();
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
    this.stopSilenceDetection();
    this.cleanupMediaStream();
    this.activeVoiceRequest?.unsubscribe();
    if (this.speakingFallbackTimeout) {
      clearTimeout(this.speakingFallbackTimeout);
    }
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    if (typeof window !== 'undefined' && window.visualViewport) {
      window.visualViewport.removeEventListener(
        'resize',
        this.onVisualViewportResize,
      );
    }
  }

  get voiceHelperText(): string {
    if (!this.supportsVoice) {
      return 'Tu navegador no soporta la experiencia de voz.';
    }

    if (this.isStartingRecording) {
      return 'Activando el microfono...';
    }

    if (this.isRecording) {
      return 'Te escucho... hace silencio cuando termines y te respondo.';
    }

    if (this.isProcessingVoice) {
      return 'POLO esta pensando tu respuesta...';
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
      this.shouldScrollToBottom = true;
    }
    if (mode === 'voice') {
      this.voiceError = this.supportsVoice
        ? null
        : 'Tu navegador no soporta la experiencia de voz.';
    }
  }

  toggleLogoutVisible() {
    this.showLogout = !this.showLogout;
  }

  toggleFullscreen(): void {
    const doc = document as Document & {
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    const docEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };

    if (!document.fullscreenElement) {
      const request = docEl.requestFullscreen || docEl.webkitRequestFullscreen;
      request?.call(docEl)?.catch?.((error: unknown) => {
        console.error('No se pudo activar pantalla completa:', error);
      });
    } else {
      const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
      exit?.call(doc);
    }
  }

  @HostListener('document:fullscreenchange')
  @HostListener('document:webkitfullscreenchange')
  onFullscreenChange(): void {
    this.isFullscreen = !!document.fullscreenElement;
  }

  toggleRecording() {
    if (!this.supportsVoice) {
      this.voiceError = 'Tu dispositivo no permite usar el microfono.';
      this.typeFinalBubbleText(
        'user',
        'Tu dispositivo no permite usar el microfono.',
      );
      this.stopBubbleTyping('bot');
      return;
    }

    if (this.isRecording) {
      this.stopRecording();
    } else if (!this.isProcessingVoice && !this.isStartingRecording) {
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
        JSON.stringify(this.questionStats),
      );
    } catch (error) {
      console.warn('No se pudieron guardar las consultas populares:', error);
    }
  }

  private updateQuickQuestions() {
    const stats = Object.values(this.questionStats).sort(
      (a, b) => b.count - a.count,
    );

    const top = stats.slice(0, 4).map((item) => item.display);

    if (top.length < 4) {
      const remainingDefaults = this.defaultQuickQuestions.filter(
        (question) => !top.includes(question),
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
    if (this.isStartingRecording || this.isRecording) return;
    this.isStartingRecording = true;

    // Si habia una respuesta anterior en camino, la cancelamos: no debe
    // poder llegar tarde y pisar la respuesta de esta consulta nueva.
    this.activeVoiceRequest?.unsubscribe();
    this.activeVoiceRequest = undefined;

    this.voiceError = null;
    this.voiceUserText = '';
    this.voiceBotText = '';
    this.cancelBotStream();
    this.stopBubbleTyping('bot');
    if (this.speakingFallbackTimeout) {
      clearTimeout(this.speakingFallbackTimeout);
      this.speakingFallbackTimeout = undefined;
    }
    this.isBotSpeaking = false;
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
      this.isStartingRecording = false;
      this.startSpeechRecognition();
      this.startSilenceDetection(stream);
    } catch (error) {
      console.error('No se pudo iniciar la grabacion', error);
      this.voiceError =
        'No se pudo acceder al microfono. Revisa los permisos del navegador.';
      this.stopBubbleTyping('user');
      this.cleanupMediaStream();
      this.isRecording = false;
      this.isStartingRecording = false;
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
    this.stopSilenceDetection();
    this.cancelBotStream();

    if (discard) {
      this.stopBubbleTyping('user');
      this.stopBubbleTyping('bot');
    }
  }

  /**
   * Analiza el volumen del microfono en vivo: apenas detecta un tramo de
   * silencio despues de que la persona hablo, corta la grabacion sola y
   * dispara el envio de la consulta (no hace falta volver a tocar el mic).
   */
  private startSilenceDetection(stream: MediaStream) {
    const SPEECH_RMS_THRESHOLD = 0.025;
    const SILENCE_DURATION_MS = 1400;
    const NO_SPEECH_TIMEOUT_MS = 8000;

    try {
      const AudioContextClass: typeof AudioContext =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      this.audioContext = audioContext;
      this.analyserNode = analyser;

      const dataArray = new Uint8Array(analyser.fftSize);
      const recordingStart = Date.now();
      let hasSpeech = false;
      let silenceStart: number | null = null;

      // El analisis corre en cada frame (~60/seg): lo hacemos fuera de la
      // zona de Angular para no disparar deteccion de cambios 60 veces por
      // segundo, que era lo que trababa la pagina mientras se escuchaba.
      this.ngZone.runOutsideAngular(() => {
        const tick = () => {
          if (!this.isRecording || !this.analyserNode) return;

          this.analyserNode.getByteTimeDomainData(dataArray);
          let sumSquares = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const normalized = (dataArray[i] - 128) / 128;
            sumSquares += normalized * normalized;
          }
          const rms = Math.sqrt(sumSquares / dataArray.length);

          if (rms > SPEECH_RMS_THRESHOLD) {
            hasSpeech = true;
            silenceStart = null;
          } else if (hasSpeech) {
            if (silenceStart === null) {
              silenceStart = Date.now();
            } else if (Date.now() - silenceStart >= SILENCE_DURATION_MS) {
              this.ngZone.run(() => this.stopRecording());
              return;
            }
          } else if (Date.now() - recordingStart >= NO_SPEECH_TIMEOUT_MS) {
            this.ngZone.run(() => {
              this.voiceError =
                'No te escuche. Toca el microfono e intenta de nuevo.';
              this.stopRecording(true);
            });
            return;
          }

          this.silenceRafId = requestAnimationFrame(tick);
        };

        this.silenceRafId = requestAnimationFrame(tick);
      });
    } catch (error) {
      console.error('No se pudo iniciar la deteccion de silencio', error);
    }
  }

  private stopSilenceDetection() {
    if (this.silenceRafId) {
      cancelAnimationFrame(this.silenceRafId);
      this.silenceRafId = undefined;
    }
    this.analyserNode = undefined;
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = undefined;
    }
  }

  private cleanupMediaStream() {
    if (this.activeStream) {
      this.activeStream.getTracks().forEach((track) => track.stop());
      this.activeStream = undefined;
    }
  }

  private speakOutFallback(text: string) {
    if (this.speakingFallbackTimeout) {
      clearTimeout(this.speakingFallbackTimeout);
      this.speakingFallbackTimeout = undefined;
    }
    if (!text) {
      this.isBotSpeaking = false;
      return;
    }
    this.isBotSpeaking = true;
    const duration = Math.min(6000, Math.max(1200, text.length * 60));
    this.speakingFallbackTimeout = setTimeout(() => {
      this.isBotSpeaking = false;
      this.speakingFallbackTimeout = undefined;
      this.cdr.detectChanges();
    }, duration) as unknown as number;
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

    this.activeVoiceRequest?.unsubscribe();
    this.activeVoiceRequest = this.chatService.sendAudio(formData).subscribe({
      next: (resp: VoiceChatResponse) => {
        this.isProcessingVoice = false;

        try {
          const transcript = String(resp?.data?.transcript ?? '').trim();
          const botText = String(resp?.data?.text ?? '').trim();

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
                this.speakOutFallback(botText);
              };
              audio.play().catch(() => {
                // El navegador bloqueo el autoplay: igual animamos la boca
                this.speakOutFallback(botText);
              });
            } catch {
              this.speakOutFallback(botText);
            }
          } else {
            this.speakOutFallback(botText);
          }
        } catch (err) {
          console.error('Error al procesar la respuesta de voz', err);
          this.stopBubbleTyping('bot');
          this.voiceBotTyping = false;
          this.voiceBotText =
            'No pude mostrar el texto, pero ya se reprodujo la respuesta.';
          this.setBubbleText('bot', this.voiceBotText);
          this.isBotSpeaking = false;
        }

        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error al enviar audio', error);
        this.isProcessingVoice = false;
        this.voiceError =
          error.status === 0
            ? 'No se pudo conectar con el servidor. Verifica tu conexion.'
            : 'No se pudo procesar el audio. Proba nuevamente en unos segundos.';
        this.stopBubbleTyping('bot');
        this.voiceBotTyping = false;
        this.voiceBotText =
          'No pude procesar el audio. Proba nuevamente en unos segundos.';
        this.setBubbleText('bot', this.voiceBotText);
        this.syncVoiceBubble('user', 'No pudimos recibir tu consulta.');
        this.isBotSpeaking = false;
        this.cdr.detectChanges();
      },
    });
  }
}
