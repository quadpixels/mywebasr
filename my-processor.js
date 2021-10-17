// Note: must bake the RingBuffer into the MyProcessor class perhaps due to how modules work.
class MyProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.soundDataCallback = undefined;
    
    // Ring buffer
    const N = 80000;
    this.N = N;
    this.entries = new Float32Array(N);  // Save
    this.idx = 0; // curr idx
    this.endidx = N-1; // End Idx
    this.tot_entries = 0
    // End ring buffer

    this.original_sample_rate = 44100; // assume 44.1 kHz input
    this.output_sample_rate   = 8000;  // 8kHz output

    this.orig_step_size = 160;
    this.out_step_size = 441;

    this.orig_step = 0;
    this.out_step  = 0;
    this.downsamp_sum = 0;
    this.downsamp_count = 0;
    
    this.fft_window_size = 400;
    this.fft_window_increment = 160;
    this.next_fft_sampsize = 400;

    this.hanning_window = [];
    const w = this.fft_window_size;
    for (let i=0; i<w; i++) {
      const y = 0.54 - 0.46 * Math.cos(2*3.1415926*i / (w-1));
      this.hanning_window.push(y);
    }
  }

  // Ring buffer stuff
  AddEntry(ety) {
    this.tot_entries ++;
    this.entries[this.idx] = ety;
    this.idx = (this.idx + 1) % (this.N);
    if (this.idx == this.endidx) {
      this.endidx = (this.idx + 1) % this.N;
    }
  }
  ResetRingBuffer() {
    this.tot_entries = 0;
    this.idx = 0;
  }
  GetNEntries(tot_idx, n) {
    const delta = this.tot_entries - tot_idx;
    let idx = (this.idx - delta + this.N) % this.N;
    let ret = [];
    for (let i=0; i<n; i++) {
      ret.push(this.entries[idx]);
      idx = (idx + 1) % this.N;
    }
    return ret;
  }
  RingBufferSize() {
    return this.tot_entries;
  }

  process (inputs, outputs, parameters) {
    const input = inputs[0][0]
    if (input == undefined) return false;

    let downsampled = [];  // Downsampled samples for this CB

    input.forEach((sp) => {
      this.orig_step += this.orig_step_size;
      this.downsamp_sum += sp;
      this.downsamp_count += 1;
      if (this.orig_step > this.out_step_size) {
        this.orig_step = (this.orig_step % this.out_step_size);
        const sp = this.downsamp_sum / this.downsamp_count;
        this.downsamp_count = 0;
        this.downsamp_sum = 0;
        this.AddEntry(sp);
        downsampled.push(sp);
      }
    });

    let fft_frames = [];
    {
      const q = this.downsampled_q;
      const w = this.fft_window_size;
      while (this.RingBufferSize() > this.next_fft_sampsize) {
        const windowed = this.GetNEntries(this.next_fft_sampsize - w, w);
        for (let i=0; i<w; i++) {
          windowed[i] *= this.hanning_window[i];
        }
        fft_frames.push(windowed);
        this.next_fft_sampsize += this.fft_window_increment;
      }
    }

    let msg = {
      "buffer": input,
      "downsampled": downsampled,
    };
    if (fft_frames.length > 0) {
      msg["fft_frames"] = fft_frames;
    }
    this.port.postMessage(msg);
    return true;
  }
}

registerProcessor('my-processor', MyProcessor)