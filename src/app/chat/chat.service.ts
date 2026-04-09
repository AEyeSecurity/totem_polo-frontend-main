// chat.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface HistoryPair {
  user: string;
  assistant: string;
}

export interface VoiceChatResponse {
  success: boolean;
  data: {
    text: string;
    audio_base64?: string;
    transcript?: string;
    db_results?: any[];
    corrected_entity?: string;
  };
  error?: boolean;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly apiUrl: string;

  constructor(private http: HttpClient) {
    const base = environment.apiUrl?.replace(/\/$/, '') || '';
    this.apiUrl = `${base}/api/voice/`;
  }

  // Texto -> Chat (sin audio)
  sendMessage(
    text: string,
    history: HistoryPair[] = []
  ): Observable<VoiceChatResponse> {
    return this.http.post<VoiceChatResponse>(`${this.apiUrl}chat`, {
      text,
      history,
    });
  }

  // Audio -> Chat (con STT + respuesta + TTS)
  sendAudio(audioData: FormData): Observable<VoiceChatResponse> {
    // El backend espera el campo 'audio'
    return this.http.post<VoiceChatResponse>(`${this.apiUrl}chat`, audioData);
  }

  // Exponer base de API para usos de streaming manual (fetch/SSE)
  getApiUrl(): string {
    return this.apiUrl;
  }

  // (Opcional) Solo STT
  transcribe(
    audioData: FormData
  ): Observable<{ success: boolean; transcript: string }> {
    return this.http.post<{ success: boolean; transcript: string }>(
      `${this.apiUrl}transcribe`,
      audioData
    );
  }

  // (Opcional) Solo TTS base64
  ttsBase64(
    text: string
  ): Observable<{ success: boolean; audio_base64: string }> {
    return this.http.post<{ success: boolean; audio_base64: string }>(
      `${this.apiUrl}synthesize-base64`,
      { text }
    );
  }
}
