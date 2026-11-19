export interface InputSnapshot {
 source: 'idle' | 'pointer' | 'keyboard'; pointerId: number | null; pointerType: string; touches: number;
 dragging: boolean; direction: { x: number; y: number }; center: { x: number; y: number }; thumb: { x: number; y: number };
}
export interface InputObservation {
 kind: 'down' | 'move' | 'up' | 'cancel' | 'capture_lost' | 'reset' | 'key';
 accepted: boolean; at: number; reason?: string; snapshot: InputSnapshot;
}
export interface DiagnosticContext {
 screen: string; running: boolean; hero?: string; runId?: string; elapsed?: number; level?: number; hp?: number;
 enemies: number; projectiles: number; effects: number; input?: InputSnapshot;
}
export interface FrameStats { frames: number; durationMs: number; fps: number; meanMs: number; p95Ms: number; maxMs: number; over33Ms: number; over50Ms: number; over100Ms: number }
export interface Sample { atMs: number; spanMs: number; frames: FrameStats; inputLatency: { count: number; meanMs: number; p95Ms: number; maxMs: number }; context: DiagnosticContext }
export interface DiagnosticEvent { atMs: number; kind: string; data: Record<string, unknown> }
