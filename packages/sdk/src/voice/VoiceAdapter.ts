export interface VoiceAdapter {
  speak(text: string): Promise<void>;
  stop(): void;
}

export class DisabledVoiceAdapter implements VoiceAdapter {
  async speak(_text: string): Promise<void> {
    return;
  }

  stop(): void {
    return;
  }
}
