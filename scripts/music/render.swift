// Render the original score with GeneralUser GS, then encode the stereo WAV with afconvert.
import AVFoundation
import Foundation

let input = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
let score = try JSONSerialization.jsonObject(with: input) as! [String: Any]
let bank = URL(fileURLWithPath: CommandLine.arguments[2])
let output = URL(fileURLWithPath: CommandLine.arguments[3])
let rate = 44100.0
let format = AVAudioFormat(standardFormatWithSampleRate: rate, channels: 2)!
let engine = AVAudioEngine()
let orchestra = AVAudioMixerNode()
engine.attach(orchestra)
let room = AVAudioUnitReverb()
room.loadFactoryPreset(.mediumHall)
room.wetDryMix = 14
engine.attach(room)
engine.connect(orchestra, to: room, format: format)
engine.connect(room, to: engine.mainMixerNode, format: format)
engine.mainMixerNode.outputVolume = 0.69
let programs: [UInt8] = [48, 42, 60, 56, 68, 47, 46, 73, 45, 52, 9, 61, 0]
let levels: [Float] = [0.50, 0.55, 0.68, 0.40, 0.57, 0.56, 0.39, 0.45, 0.44, 0.27, 0.26, 0.35, 0.46]
let pans: [Float] = [-0.34, 0.22, -0.12, 0.21, 0.32, -0.08, 0.37, -0.26, 0.29, 0, 0.42, -0.19, 0.05]
let samplers = try programs.enumerated().map { index, program in
    let sampler = AVAudioUnitSampler()
    engine.attach(sampler)
    engine.connect(sampler, to: orchestra, fromBus: 0, toBus: AVAudioNodeBus(index), format: format)
    try sampler.loadSoundBankInstrument(
        at: bank, program: program,
        bankMSB: UInt8(index == programs.count - 1 ? kAUSampler_DefaultPercussionBankMSB : kAUSampler_DefaultMelodicBankMSB),
        bankLSB: UInt8(kAUSampler_DefaultBankLSB))
    sampler.stereoPan = pans[index]
    sampler.masterGain = 20 * log10(levels[index])
    return sampler
}

struct Event {
    let frame: Int64
    let instrument: Int
    let key: UInt8
    let velocity: UInt8
}
var events: [Event] = []
for note in score["events"] as! [[Double]] {
    let instrument = Int(note[0]), key = UInt8(note[3]), velocity = UInt8(note[4])
    let start = Int64(note[1] * rate), end = Int64((note[1] + note[2]) * rate)
    events.append(Event(frame: start, instrument: instrument, key: key, velocity: velocity))
    events.append(Event(frame: end, instrument: instrument, key: key, velocity: 0))
}
events.sort { a, b in a.frame == b.frame ? a.velocity < b.velocity : a.frame < b.frame }
let frames = Int64((score["duration"] as! Double) * rate)
try engine.enableManualRenderingMode(.offline, format: format, maximumFrameCount: 512)
try engine.start()
let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 512)!
var file: AVAudioFile? = try AVAudioFile(forWriting: output, settings: format.settings)
var cursor: Int64 = 0, eventIndex = 0
var peak: Float = 0, energy: Double = 0
while cursor < frames {
    while eventIndex < events.count && events[eventIndex].frame <= cursor {
        let event = events[eventIndex]
        let sampler = samplers[event.instrument]
        if event.velocity == 0 { sampler.stopNote(event.key, onChannel: 0) }
        else { sampler.startNote(event.key, withVelocity: event.velocity, onChannel: 0) }
        eventIndex += 1
    }
    let next = eventIndex < events.count ? events[eventIndex].frame : frames
    let count = AVAudioFrameCount(min(512, min(frames, next) - cursor))
    guard try engine.renderOffline(count, to: buffer) == .success else { fatalError("Render failed") }
    let channels = buffer.floatChannelData!
    for i in 0..<Int(buffer.frameLength) {
        let at = cursor + Int64(i)
        let fade = Float(min(1, Double(at) / 150, Double(frames - at) / 550))
        for channel in 0..<2 {
            let x = channels[channel][i] * fade
            peak = max(peak, abs(x))
            energy += Double(x * x)
            channels[channel][i] = x
        }
    }
    try file?.write(from: buffer)
    cursor += Int64(buffer.frameLength)
}
file = nil
print("duration \(Double(frames)/rate)s, peak \(peak), RMS \(sqrt(energy/Double(frames*2)))")
guard peak > 0.1 && peak < 1 else { fatalError("Unexpected render level") }
