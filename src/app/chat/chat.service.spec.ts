import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ChatService, VoiceChatResponse } from './chat.service';
import { environment } from '../../environments/environment';

describe('ChatService', () => {
  let service: ChatService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/api/voice/`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ChatService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created and expose the voice api base url', () => {
    expect(service).toBeTruthy();
    expect(service.getApiUrl()).toBe(base);
  });

  it('sendMessage should POST the text and history to the chat endpoint', () => {
    let response: VoiceChatResponse | undefined;
    const history = [{ user: 'Hola', assistant: 'Hola, en que te ayudo?' }];

    service.sendMessage('Necesito info', history).subscribe((res) => {
      response = res;
    });

    const req = httpMock.expectOne(`${base}chat`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ text: 'Necesito info', history });

    const mockResponse: VoiceChatResponse = {
      success: true,
      data: { text: 'Respuesta del bot' },
    };
    req.flush(mockResponse);

    expect(response).toEqual(mockResponse);
  });

  it('sendMessage should default to an empty history when none is provided', () => {
    service.sendMessage('Hola').subscribe();

    const req = httpMock.expectOne(`${base}chat`);
    expect(req.request.body.history).toEqual([]);
    req.flush({ success: true, data: { text: 'ok' } });
  });

  it('sendAudio should POST the FormData to the chat endpoint', () => {
    const formData = new FormData();
    formData.append('audio', new Blob(['abc']), 'voz.webm');

    service.sendAudio(formData).subscribe();

    const req = httpMock.expectOne(`${base}chat`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBe(formData);
    req.flush({ success: true, data: { text: 'ok', transcript: 'hola' } });
  });

  it('transcribe should POST to the transcribe endpoint', () => {
    const formData = new FormData();
    service.transcribe(formData).subscribe();

    const req = httpMock.expectOne(`${base}transcribe`);
    expect(req.request.method).toBe('POST');
    req.flush({ success: true, transcript: 'hola mundo' });
  });

  it('ttsBase64 should POST the text to the synthesize-base64 endpoint', () => {
    service.ttsBase64('Hola').subscribe();

    const req = httpMock.expectOne(`${base}synthesize-base64`);
    expect(req.request.body).toEqual({ text: 'Hola' });
    req.flush({ success: true, audio_base64: 'ZmFrZQ==' });
  });
});
