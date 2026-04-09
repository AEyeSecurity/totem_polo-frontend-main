// chat.component.ts
import {
  Component,
  OnInit,
  ElementRef,
  ViewChild,
  AfterViewChecked,
  OnDestroy,
  ChangeDetectorRef,
} from '@angular/core';
import { ChatService, VoiceChatResponse } from './chat.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
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
  imports: [FormsModule, CommonModule, LogoutButtonComponent],
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
            <svg
              *ngIf="isDarkMode"
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

            <svg
              *ngIf="!isDarkMode"
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

      <div class="chat-container" *ngIf="chatMode === 'text'; else voiceMode">
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
              <div
                *ngFor="let message of messages; trackBy: trackByMessageId"
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

              <div
                *ngIf="isTyping"
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
                <span *ngIf="!isTyping" class="material-symbols-outlined">
                  send
                </span>
                <span *ngIf="isTyping" class="loading-text">...</span>
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
            <button
              type="button"
              class="quick-question"
              *ngFor="let question of quickQuestions"
              (click)="handleQuickQuestion(question)"
              [disabled]="isTyping"
            >
              <span>{{ question }}</span>
              <span class="material-symbols-outlined">arrow_forward</span>
            </button>
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

      <ng-template #voiceMode>
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
                <span *ngIf="isRecording">Escuchando tu consulta...</span>
                <span *ngIf="!isRecording && isProcessingVoice"
                  >Generando respuesta...</span
                >
              </div>
              <p class="voice-error" *ngIf="voiceError">{{ voiceError }}</p>
            </div>
          </div>
        </section>
      </ng-template>
    </div>
  `,

  styles: [
    `
      @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined');

      :host {
        display: block;
      }

      :host {
        display: block;
        min-height: 100vh;
      }

      .chat-wrapper {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        padding: 4px 10px 12px;
        background: linear-gradient(
          120deg,
          #e6f0ff 0%,
          #f7f9fc 60%,
          #eef2f6 100%
        );
        font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
        color: #495057;
        font-size: clamp(0.88rem, 0.9vw, 0.98rem);
        overflow-x: hidden;
        overflow-y: auto;
        box-sizing: border-box;
      }

      .chat-wrapper.dark-mode {
        background: linear-gradient(135deg, #0f0f0f 0%, #1c1c1c 60%, #222 100%);
        color: #e0e0e0;
      }

      .chat-header {
        background: #ffffff;
        padding: 10px 14px;
        border-bottom: 1px solid #dee2e6;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .dark-mode .chat-header {
        background: #2d2d2d;
        border-bottom: 1px solid #404040;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      }

      .header-content {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .chat-mode-switch {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 16px 14px;
      }

      .mode-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-radius: 999px;
        border: 1px solid #ced4da;
        background: white;
        color: #343a40;
        padding: 6px 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.25s ease;
      }

      .mode-pill .material-symbols-outlined {
        font-size: 18px;
      }

      .mode-pill.active {
        background: #212529;
        color: white;
        border-color: #212529;
        box-shadow: 0 8px 18px rgba(33, 37, 41, 0.25);
      }

      .mode-pill:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .mode-toggle-btn {
        background: transparent;
        border: 1px solid #dee2e6;
        border-radius: 8px;
        padding: 6px;
        cursor: pointer;
        transition: all 0.3s ease;
        color: #495057;
      }

      .mode-toggle-btn:hover {
        border-color: #adb5bd;
        background: rgba(73, 80, 87, 0.05);
      }

      .dark-mode .mode-toggle-btn {
        border-color: #555;
        color: #f1f1f1;
      }

      .bot-avatar {
        position: relative;
        width: 38px;
        height: 38px;
        border-radius: 12px;
        background: linear-gradient(135deg, #9a9a9a, #cfcfcf);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 700;
        font-size: 12px;
      }

      .avatar-icon {
        letter-spacing: 0.5px;
      }

      .status-indicator {
        position: absolute;
        bottom: -2px;
        right: -2px;
        width: 12px;
        height: 12px;
        background: #dc3545;
        border-radius: 50%;
        border: 2px solid white;
        transition: background-color 0.3s ease;
      }

      .dark-mode .status-indicator {
        border: 2px solid #2d2d2d;
      }

      .status-indicator.active {
        background: #28a745;
        box-shadow: 0 0 8px rgba(40, 167, 69, 0.4);
      }

      .header-info h2 {
        margin: 0;
        color: #212529;
        font-size: 16px;
        font-weight: 600;
        line-height: 1.2;
      }

      .dark-mode .header-info h2 {
        color: #e0e0e0;
      }

      .status-text {
        margin: 0;
        color: #6c757d;
        font-size: 14px;
        font-weight: 400;
        margin-top: 2px;
      }

      .dark-mode .status-text {
        color: #a0a0a0;
      }

      .chat-container {
        flex: 1;
        min-height: 0;
        display: flex;
        gap: 14px;
        padding: 10px 8px 12px;
        width: 100%;
        max-width: 1180px;
        margin: 0 auto;
        box-sizing: border-box;
      }

      .voice-experience {
        width: 100%;
        flex: 1;
        padding: clamp(8px, 1.6vw, 22px);
        box-sizing: border-box;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .voice-hero {
        width: 100%;
        max-width: min(760px, 92vw);
        background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.92),
            rgba(255, 255, 255, 0.75)
          ),
          url('/assets/images/polo-inicio.jpg') center/cover no-repeat;
        border-radius: clamp(20px, 2.8vw, 32px);
        padding: clamp(14px, 1.8vw, 22px);
        color: #101a2d;
        box-shadow: 0 18px 36px rgba(15, 23, 42, 0.18);
        border: 1px solid rgba(255, 255, 255, 0.65);
        backdrop-filter: blur(14px);
        display: flex;
        flex-direction: column;
        gap: clamp(12px, 1.6vw, 24px);
      }

      .voice-hero-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: clamp(10px, 2vw, 24px);
      }

      .voice-hero-header h3 {
        margin: 6px 0 4px;
        font-size: clamp(1.3rem, 2.3vw, 2rem);
      }

      .voice-hero-header .subtitle {
        margin: 0;
        max-width: 420px;
        color: rgba(16, 26, 45, 0.85);
      }

      .tag-label {
        display: inline-flex;
        padding: 4px 12px;
        border-radius: 999px;
        background: rgba(16, 26, 45, 0.08);
        font-size: 0.75rem;
        letter-spacing: 1px;
        color: #0f172a;
      }

      .voice-hero-header {
        position: relative;
        z-index: 2;
      }

      .voice-stage {
        display: grid;
        grid-template-columns: minmax(150px, 0.9fr) auto minmax(150px, 0.9fr);
        grid-template-areas: 'user robot bot';
        gap: clamp(10px, 1.6vw, 20px);
        align-items: center;
        justify-content: center;
        justify-items: center;
        position: relative;
        z-index: 1;
      }

      .speech-bubble {
        background: rgba(255, 255, 255, 0.96);
        color: #1d1f2c;
        border-radius: 18px;
        padding: clamp(10px, 1vw, 16px);
        min-height: 110px;
        box-shadow: 0 12px 22px rgba(15, 23, 42, 0.14);
        position: relative;
        backdrop-filter: blur(8px);
        transition: transform 0.3s ease;
        border: 1px solid rgba(255, 255, 255, 0.9);
        max-width: clamp(150px, 26vw, 210px);
        width: 100%;
      }

      .speech-bubble.filled {
        transform: translateY(-6px);
      }

      .speech-bubble p {
        margin: 8px 0 0;
        color: rgba(18, 18, 18, 0.9);
        font-size: 0.98rem;
        line-height: 1.45;
        min-height: 60px;
        display: flex;
        align-items: center;
        letter-spacing: 0.2px;
      }

      .bubble-label {
        font-size: 0.85rem;
        font-weight: 600;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        color: #7c7c7c;
      }

      .speech-bubble.typing p::after {
        content: '...';
        margin-left: 4px;
        animation: blink 1s steps(1) infinite;
      }

      .user-bubble::after,
      .bot-bubble::after {
        content: '';
        position: absolute;
        bottom: -18px;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.95);
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.15);
      }

      .user-bubble::after {
        left: 28px;
      }

      .bot-bubble::after {
        right: 28px;
      }

      .user-bubble {
        grid-area: user;
        justify-self: end;
        margin-right: clamp(12px, 2vw, 40px);
      }

      .bot-bubble {
        grid-area: bot;
        justify-self: start;
        margin-left: clamp(12px, 2vw, 40px);
      }

      .robot-figure {
        grid-area: robot;
        margin-top: clamp(8px, 1.5vw, 24px);
      }

      .robot-figure {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
      }

      .robot-antenna-set {
        display: flex;
        justify-content: center;
        gap: clamp(10px, 3vw, 28px);
        margin-bottom: -4px;
      }

      .antenna {
        width: 5px;
        height: clamp(30px, 5vw, 46px);
        background: #0f172a;
        border-radius: 999px;
        position: relative;
      }

      .antenna::after {
        content: '';
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #0f172a;
        position: absolute;
        top: -10px;
        left: 50%;
        transform: translateX(-50%);
      }

      .robot-head {
        width: clamp(120px, 16vw, 170px);
        height: clamp(105px, 14vw, 145px);
        background: #f5f8fb;
        border-radius: 32px;
        border: 5px solid #0f172a;
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: clamp(14px, 2vw, 22px);
        box-shadow: inset 0 -8px 0 rgba(15, 23, 42, 0.07);
      }

      .head-screw {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        border: 2px solid #0f172a;
        position: absolute;
        background: #dfe5f1;
      }

      .screw-top-left {
        top: 12px;
        left: 16px;
      }
      .screw-top-right {
        top: 12px;
        right: 16px;
      }
      .screw-bottom-left {
        bottom: 12px;
        left: 16px;
      }
      .screw-bottom-right {
        bottom: 12px;
        right: 16px;
      }

      .head-ear {
        position: absolute;
        width: clamp(22px, 3vw, 32px);
        height: clamp(32px, 6vw, 56px);
        background: #0f172a;
        border-radius: 20px;
        top: 50%;
        transform: translateY(-50%);
      }

      .ear-left {
        left: calc(clamp(26px, 4vw, 38px) / -2);
      }

      .ear-right {
        right: calc(clamp(26px, 4vw, 38px) / -2);
      }

      .robot-eyes {
        display: flex;
        gap: clamp(12px, 3vw, 26px);
        margin-bottom: clamp(6px, 1vw, 10px);
      }

      .eye {
        width: clamp(32px, 5vw, 50px);
        height: clamp(32px, 5vw, 50px);
        border-radius: 50%;
        background: #0f172a;
        border: 5px solid #0f172a;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: inset 0 -4px 0 rgba(255, 255, 255, 0.1);
      }

      .eye .pupil {
        width: 55%;
        height: 55%;
        background: #fff;
        border-radius: 50%;
        display: block;
      }

      .eye .shine {
        position: absolute;
        width: 12px;
        height: 12px;
        background: rgba(255, 255, 255, 0.8);
        border-radius: 50%;
        top: 12px;
        left: 10px;
      }

      .robot-smile {
        width: clamp(50px, 9vw, 88px);
        height: 12px;
        border-bottom: 4px solid #0f172a;
        border-radius: 0 0 60px 60px;
      }

      .robot-head.talking {
        animation: nod 0.9s ease-in-out infinite;
      }

      .robot-smile.talking {
        animation: mouth-talk 0.35s ease-in-out infinite;
        transform-origin: center;
      }

      @keyframes mouth-talk {
        0% {
          transform: scaleY(1);
        }
        25% {
          transform: scaleY(0.5);
        }
        50% {
          transform: scaleY(1.2);
        }
        75% {
          transform: scaleY(0.6);
        }
        100% {
          transform: scaleY(1);
        }
      }

      @keyframes nod {
        0%,
        100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-2px);
        }
      }
      .robot-neck {
        width: clamp(38px, 7vw, 60px);
        height: 14px;
        background: #0f172a;
        border-radius: 14px;
        margin: -2px auto 8px;
      }

      .robot-body {
        width: clamp(140px, 20vw, 200px);
        height: clamp(140px, 22vw, 220px);
        background: #f5f8fb;
        border-radius: 28px;
        border: 5px solid #0f172a;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: clamp(10px, 2vw, 20px);
      }

      .body-plate {
        width: 100%;
        height: 100%;
        border-radius: 22px;
        background: linear-gradient(145deg, #fefefe, #dfe6f3);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: inset 0 -10px 18px rgba(15, 23, 42, 0.08);
      }

      .logo-box {
        width: clamp(90px, 14vw, 150px);
        height: clamp(84px, 13vw, 140px);
        border-radius: 28px;
        background: url('/assets/images/PoloLogo-rojo.jpg') center/cover
          no-repeat;
        box-shadow: 0 8px 20px rgba(217, 4, 41, 0.35);
      }

      .robot-arm {
        position: absolute;
        top: 30%;
        width: clamp(40px, 7vw, 80px);
        height: clamp(110px, 18vw, 160px);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      }

      .arm-left {
        left: calc(-1 * clamp(40px, 7vw, 80px));
      }

      .arm-right {
        right: calc(-1 * clamp(40px, 7vw, 80px));
      }

      .arm-joint {
        width: clamp(16px, 2.5vw, 24px);
        flex: 1;
        background: #f5f8fb;
        border: 4px solid #0f172a;
        border-radius: 36px;
      }

      .hand {
        width: clamp(30px, 5vw, 50px);
        height: clamp(34px, 5vw, 52px);
        border-radius: 14px 14px 12px 12px;
        border: 4px solid #0f172a;
        background: #0f172a;
        position: relative;
      }

      .hand::after {
        content: '';
        position: absolute;
        inset: 8px;
        border-radius: 8px;
        border: 2px solid #fff;
      }

      .robot-legs {
        display: flex;
        gap: clamp(14px, 2.5vw, 32px);
        margin-top: -2px;
      }

      .leg {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
      }

      .leg-knee {
        width: clamp(18px, 3.5vw, 28px);
        height: clamp(40px, 8vw, 60px);
        border: 4px solid #0f172a;
        border-radius: 40px;
        background: #f5f8fb;
      }

      .foot {
        width: clamp(40px, 7vw, 70px);
        height: clamp(20px, 3.2vw, 30px);
        background: #0f172a;
        border-radius: 40px;
      }

      .voice-controls {
        margin-top: clamp(12px, 2vw, 24px);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
      }

      .mic-button {
        width: 68px;
        height: 68px;
        border-radius: 50%;
        border: 3px solid rgba(16, 26, 45, 0.15);
        background: rgba(255, 255, 255, 0.9);
        color: #0f172a;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 30px;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 14px 28px rgba(15, 23, 42, 0.15);
      }

      .mic-button.is-recording {
        background: #d90429;
        color: #fff;
        border-color: #ffd6de;
        box-shadow: 0 16px 34px rgba(217, 4, 41, 0.35);
      }

      .mic-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .mic-helper {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 500;
        color: rgba(16, 26, 45, 0.8);
      }

      .voice-status {
        height: 20px;
        font-size: 0.85rem;
        letter-spacing: 1px;
        color: rgba(16, 26, 45, 0.8);
      }

      .voice-error {
        margin: 4px 0 0;
        color: #b42318;
        font-weight: 600;
      }

      .chat-panel {
        flex: 2.4;
        display: flex;
        flex-direction: column;
        gap: 14px;
        min-height: 0;
      }

      .sidebar {
        flex: 0.6;
        max-width: 260px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-height: 0;
      }

      .panel-card,
      .sidebar-card {
        background: rgba(255, 255, 255, 0.95);
        border-radius: 14px;
        padding: 12px;
        border: 1px solid #edf0f2;
        box-shadow: 0 10px 20px rgba(15, 23, 42, 0.05);
        backdrop-filter: blur(4px);
      }

      .dark-mode .panel-card,
      .dark-mode .sidebar-card {
        background: #272727;
        border: 1px solid #3a3a3a;
        box-shadow: 0 16px 32px rgba(0, 0, 0, 0.45);
      }

      .messages-card {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0; /* allow inner scroll */
      }

      .panel-title {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 16px;
      }

      .panel-title-icon {
        width: 34px;
        height: 34px;
        border-radius: 12px;
        background: #eef2ff;
        color: #4254ff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
      }

      .panel-title h3 {
        margin: 0;
        color: #1d1f2c;
        font-size: 17px;
      }

      .panel-title small {
        display: block;
        color: #6c757d;
        margin-top: 2px;
        font-size: 12px;
      }

      .dark-mode .panel-title-icon {
        background: #333;
        color: #8ab4ff;
      }

      .dark-mode .panel-title h3 {
        color: #f1f1f1;
      }

      .dark-mode .panel-title small {
        color: #b0b0b0;
      }

      .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding-right: 6px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-height: 0;
      }

      .message-wrapper {
        display: flex;
        animation: fadeIn 0.2s ease-out;
      }

      .user-wrapper {
        justify-content: flex-end;
      }

      .bot-wrapper {
        justify-content: flex-start;
      }

      .message-content {
        max-width: 65%;
        position: relative;
      }

      .user-message {
        background: #495057;
        color: white;
        padding: 10px 14px;
        border-radius: 14px 14px 4px 14px;
        border: 1px solid #495057;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      }

      .dark-mode .user-message {
        background: #e9ecef;
        color: #212529;
        border: 1px solid #e9ecef;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
      }

      .bot-message {
        background: #f8f9fa;
        color: #212529;
        padding: 10px 14px;
        border-radius: 14px 14px 14px 4px;
        border: 1px solid #dee2e6;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      }

      .dark-mode .bot-message {
        background: #383838;
        color: #f5f5f5;
        border: 1px solid #505050;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
      }

      .message-text {
        white-space: pre-line;
        line-height: 1.5;
      }

      .message-time {
        font-size: 11px;
        opacity: 0.6;
        margin-top: 4px;
        text-align: right;
      }

      .typing-message {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .typing-dots span {
        width: 6px;
        height: 6px;
        background: #495057;
        display: inline-block;
        border-radius: 50%;
        animation: bounce 1.4s infinite;
      }

      .typing-dots span:nth-child(2) {
        animation-delay: 0.2s;
      }

      .typing-dots span:nth-child(3) {
        animation-delay: 0.4s;
      }

      .dark-mode .typing-dots span {
        background: #f1f1f1;
      }

      .input-card {
        padding: 16px;
      }

      .chat-input {
        display: flex;
        align-items: center;
        gap: 8px;
        border: 1px solid #e1e5ec;
        border-radius: 14px;
        padding: 8px 12px;
        background: #f8fafc;
      }

      .dark-mode .chat-input {
        background: #1f1f1f;
        border: 1px solid #3a3a3a;
      }

      .message-input {
        flex: 1;
        border: none;
        background: transparent;
        font-size: 15px;
        color: inherit;
      }

      .message-input:focus {
        outline: none;
      }

      .send-button {
        width: 38px;
        height: 38px;
        border-radius: 12px;
        border: none;
        background: #495057;
        color: white;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.2s ease, opacity 0.2s ease;
      }

      .send-button:not(:disabled):hover {
        transform: translateY(-2px);
      }

      .send-button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .dark-mode .send-button {
        background: #f1f3f5;
        color: #212529;
      }

      .loading-text {
        font-size: 18px;
        letter-spacing: 2px;
      }

      .input-footer {
        margin-top: 12px;
        text-align: center;
        font-size: 14px;
        color: #6c757d;
      }

      .dark-mode .input-footer {
        color: #b4b4b4;
      }

      .card-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
      }

      .card-header h3 {
        margin: 0;
        font-size: 15px;
        color: #1d1f2c;
      }

      .card-header p {
        margin: 0;
        font-size: 11px;
        color: #6c757d;
      }

      .card-header .material-symbols-outlined {
        font-size: 26px;
        color: #ff8a00;
      }

      .dark-mode .card-header h3 {
        color: #f1f1f1;
      }

      .dark-mode .card-header p {
        color: #b0b0b0;
      }

      .dark-mode .card-header .material-symbols-outlined {
        color: #f0b35a;
      }

      .quick-question {
        width: 100%;
        border: 1px solid #e4e7ec;
        background: #fff;
        border-radius: 12px;
        padding: 6px 10px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 12px;
        color: #1f1f1f;
        cursor: pointer;
        transition: border-color 0.2s ease, box-shadow 0.2s ease,
          transform 0.2s ease;
      }

      .quick-question + .quick-question {
        margin-top: 12px;
      }

      .quick-question:hover:not(:disabled) {
        border-color: #b4c2ff;
        box-shadow: 0 12px 20px rgba(56, 72, 255, 0.12);
        transform: translateY(-1px);
      }

      .quick-question:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .quick-question .material-symbols-outlined {
        font-size: 18px;
        color: #98a2ff;
      }

      .dark-mode .quick-question {
        background: #1f1f1f;
        color: #f5f5f5;
        border: 1px solid #3a3a3a;
      }

      .dark-mode .quick-question .material-symbols-outlined {
        color: #8ab4ff;
      }

      .contact-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .contact-list li {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        padding-bottom: 8px;
        border-bottom: 1px solid #edf0f2;
      }

      .contact-list li:last-child {
        border-bottom: none;
      }

      .contact-list strong {
        display: block;
        color: #1d1f2c;
        font-size: 13px;
      }

      .contact-list small {
        color: #6c757d;
        font-size: 11px;
      }

      .contact-list .material-symbols-outlined {
        font-size: 22px;
        color: #4254ff;
      }

      .dark-mode .contact-list li {
        border-color: #373737;
      }

      .dark-mode .contact-list strong {
        color: #f5f5f5;
      }

      .dark-mode .contact-list small {
        color: #b0b0b0;
      }

      .dark-mode .contact-list .material-symbols-outlined {
        color: #8ab4ff;
      }

      .chat-messages::-webkit-scrollbar {
        width: 8px;
      }

      .chat-messages::-webkit-scrollbar-track {
        background: #f1f3f4;
        border-radius: 4px;
        margin: 10px 0;
      }

      .dark-mode .chat-messages::-webkit-scrollbar-track {
        background: #404040;
      }

      .chat-messages::-webkit-scrollbar-thumb {
        background: #ced4da;
        border-radius: 4px;
      }

      .dark-mode .chat-messages::-webkit-scrollbar-thumb {
        background: #666;
      }

      .chat-messages::-webkit-scrollbar-thumb:hover {
        background: #adb5bd;
      }

      .dark-mode .chat-messages::-webkit-scrollbar-thumb:hover {
        background: #777;
      }

      @media (max-width: 1200px), (max-height: 760px) {
        .chat-container {
          padding: 14px 10px;
          gap: 14px;
          height: calc(100vh - 140px);
        }

        .panel-card,
        .sidebar-card {
          padding: 16px;
        }

        .message-content {
          max-width: 75%;
        }

        .voice-hero {
          padding: 22px;
        }

        .voice-stage {
          gap: 16px;
        }
      }

      @media (max-width: 992px) {
        .chat-container {
          flex-direction: column;
          padding: 14px 10px 20px;
        }

        .chat-panel,
        .sidebar {
          gap: 14px;
        }

        .sidebar {
          flex-direction: row;
          flex-wrap: wrap;
        }

        .sidebar-card {
          flex: 1 1 220px;
        }

        .voice-stage {
          grid-template-columns: minmax(120px, 0.9fr) auto minmax(120px, 0.9fr);
          gap: 14px;
        }

        .speech-bubble {
          max-width: clamp(140px, 32vw, 190px);
          margin: 0 auto;
        }

        .user-bubble,
        .bot-bubble {
          margin: 0 8px;
        }

        .voice-hero {
          padding: 14px;
        }
      }

      @media (max-width: 768px) {
        .chat-container {
          padding: 12px 8px 18px;
        }

        .panel-card,
        .sidebar-card {
          padding: 14px;
        }

        .message-content {
          max-width: 85%;
        }

        .voice-stage {
          grid-template-columns: minmax(110px, 0.9fr) auto minmax(110px, 0.9fr);
          gap: 10px;
        }

        .robot-head {
          width: clamp(110px, 34vw, 140px);
          height: clamp(95px, 28vw, 120px);
        }

        .robot-body {
          width: clamp(105px, 32vw, 140px);
          height: clamp(100px, 30vw, 140px);
        }

        .voice-controls {
          margin-top: 14px;
        }
      }

      @media (max-width: 576px) {
        .chat-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 16px;
        }

        .header-actions {
          width: 100%;
          justify-content: space-between;
        }

        .chat-panel {
          gap: 16px;
        }

        .chat-input {
          flex-direction: column;
          align-items: stretch;
        }

        .send-button {
          width: 100%;
        }

        .voice-hero {
          border-radius: 20px;
        }

        .speech-bubble {
          padding: 10px;
        }

        .logo-box {
          width: clamp(80px, 36vw, 110px);
          height: clamp(70px, 30vw, 100px);
        }
      }

      @media (orientation: portrait) and (min-width: 577px) {
        .chat-container {
          flex-direction: column;
          max-width: 640px;
          height: auto;
        }

        .sidebar {
          flex-direction: column;
        }

        .message-content {
          max-width: 80%;
        }

        .voice-experience {
          padding: 16px;
        }

        .voice-hero {
          min-height: auto;
        }

        .voice-stage {
          grid-template-columns: minmax(110px, 0.9fr) auto minmax(110px, 0.9fr);
          gap: 12px;
        }
      }

      @media (max-aspect-ratio: 3/4) {
        .chat-container {
          flex-direction: column;
          max-width: 720px;
        }

        .voice-hero {
          min-height: auto;
        }

        .voice-stage {
          grid-template-columns: minmax(110px, 0.9fr) auto minmax(110px, 0.9fr);
          gap: 12px;
        }

        .robot-head {
          transform: scale(0.88);
        }
      }

      @media (max-height: 700px) {
        .voice-hero {
          padding: 14px;
          gap: 14px;
        }

        .voice-stage {
          gap: 9px;
        }

        .speech-bubble {
          min-height: 90px;
          max-width: clamp(120px, 28vw, 160px);
        }

        .mic-button {
          width: 54px;
          height: 54px;
        }
      }

      @media (max-width: 520px) {
        .voice-stage {
          grid-template-columns: 1fr;
          grid-template-areas:
            'user'
            'robot'
            'bot';
          gap: 14px;
        }

        .user-bubble,
        .bot-bubble {
          justify-self: center;
          margin: 0;
        }

        .speech-bubble {
          max-width: min(260px, 90vw);
        }
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes bounce {
        0%,
        80%,
        100% {
          transform: scale(0);
        }
        40% {
          transform: scale(1);
        }
      }

      @keyframes blink {
        0%,
        49% {
          opacity: 1;
        }
        50%,
        100% {
          opacity: 0;
        }
      }
    `,
  ],
})
export class ChatbotComponent implements OnInit, AfterViewChecked, OnDestroy {
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

  constructor(
    private chatService: ChatService,
    private cdr: ChangeDetectorRef
  ) {
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

  private getChatHistory(): Array<{ user: string; assistant: string }> {
    const history: Array<{ user: string; assistant: string }> = [];
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

      rec.onerror = () => {};
      rec.onend = () => {
        // no-op; recording lifecycle controla micrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³fono
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

