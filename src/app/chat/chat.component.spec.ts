import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ChatbotComponent } from './chat.component';
import { ChatService, VoiceChatResponse } from './chat.service';

describe('ChatbotComponent', () => {
  let component: ChatbotComponent;
  let fixture: ComponentFixture<ChatbotComponent>;
  let chatServiceSpy: jasmine.SpyObj<ChatService>;

  beforeEach(async () => {
    chatServiceSpy = jasmine.createSpyObj('ChatService', [
      'sendMessage',
      'sendAudio',
    ]);

    await TestBed.configureTestingModule({
      imports: [ChatbotComponent],
      providers: [
        { provide: ChatService, useValue: chatServiceSpy },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    localStorage.clear();
    fixture = TestBed.createComponent(ChatbotComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create and greet the user with a welcome message', () => {
    expect(component).toBeTruthy();
    expect(component.messages.length).toBe(1);
    expect(component.messages[0].sender).toBe('bot');
  });

  it('setChatMode should switch between text and voice', () => {
    expect(component.chatMode).toBe('voice');
    component.setChatMode('text');
    expect(component.chatMode).toBe('text');
    component.setChatMode('voice');
    expect(component.chatMode).toBe('voice');
  });

  it('should ignore empty messages', () => {
    component.userMessage = '   ';
    component.sendMessage();
    expect(chatServiceSpy.sendMessage).not.toHaveBeenCalled();
  });

  it('should send the trimmed message and append the bot reply', fakeAsync(() => {
    const response: VoiceChatResponse = {
      success: true,
      data: { text: 'Hola, en que te ayudo?' },
    };
    chatServiceSpy.sendMessage.and.returnValue(of(response));

    component.userMessage = '  Necesito info  ';
    component.sendMessage();

    expect(component.userMessage).toBe('');
    expect(component.isTyping).toBeTrue();
    expect(
      component.messages[component.messages.length - 1].content
    ).toBe('Necesito info');

    tick(1000); // flush the initial artificial delay before calling the service
    expect(chatServiceSpy.sendMessage).toHaveBeenCalledWith(
      'Necesito info',
      jasmine.any(Array)
    );

    tick(5000); // flush the character-by-character typing simulation
    const lastMessage = component.messages[component.messages.length - 1];
    expect(lastMessage.sender).toBe('bot');
    expect(lastMessage.content).toBe('Hola, en que te ayudo?');
    expect(component.isTyping).toBeFalse();
  }));

  it('should show a connection error message when the request fails with status 0', fakeAsync(() => {
    chatServiceSpy.sendMessage.and.returnValue(
      throwError(() => ({ status: 0 }))
    );

    component.userMessage = 'Hola';
    component.sendMessage();
    tick(1000);
    tick(5000);

    const lastMessage = component.messages[component.messages.length - 1];
    expect(lastMessage.content).toContain('No se pudo conectar');
  }));

  it('handleQuickQuestion should populate the input and send it', fakeAsync(() => {
    chatServiceSpy.sendMessage.and.returnValue(
      of({ success: true, data: { text: 'ok' } })
    );

    component.handleQuickQuestion('Disponibilidad de lotes');
    tick(1000);
    tick(5000);

    expect(chatServiceSpy.sendMessage).toHaveBeenCalledWith(
      'Disponibilidad de lotes',
      jasmine.any(Array)
    );
  }));

  it('trackByMessageId should return the message id', () => {
    const msg = { sender: 'bot' as const, content: 'x', timestamp: new Date(), id: 'abc' };
    expect(component.trackByMessageId(0, msg)).toBe('abc');
  });

  it('formatMessage should convert newlines to <br>', () => {
    expect(component.formatMessage('linea1\nlinea2')).toBe(
      'linea1<br>linea2'
    );
  });
});
