import { Component } from '@angular/core';
import { ChatbotComponent } from '../../chat/chat.component';

@Component({
  selector: 'app-chatbot-fab',
  standalone: true,
  imports: [ChatbotComponent],
  templateUrl: './chatbot-fab.component.html',
  styleUrl: './chatbot-fab.component.css',
})
export class ChatbotFabComponent {
  open = false;

  openChat(): void {
    this.open = true;
  }

  closeChat(): void {
    this.open = false;
  }
}
