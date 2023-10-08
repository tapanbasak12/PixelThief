import * as Path from 'path';
import * as path from 'path';
import * as util from 'util';
import * as zlib from 'zlib';
import express from 'express';
import serve from 'serve-static';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import { join } from 'path';

const hostname = '0.0.0.0'
const port     = 8080
const app      = express();
const files    = process.env["FILES"] ?? (Path.join(process.cwd(), "output"));
const tools    = process.env["TOOLS"] ?? (Path.join(process.cwd(), "src/tools"));

console.log(`[SERVER] Files: ${files}`);
console.log(`[SERVER] Tools: ${tools}`);

app.use(function (req, res, next) {
    res.header("Cross-Origin-Embedder-Policy", "require-corp");
    res.header("Cross-Origin-Opener-Policy", "same-origin");
    next();
})

app.use(express.text({ limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.raw({ limit: '50mb', type: 'image/png' }));

app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'static/index.htm'));
});

app.get('/js/:path(*)', async (req, res, next) => {
    const path = req.params.path as string

    if (path.endsWith('.js')) {
        const file = join(process.cwd(), 'dist', path)
        res.sendFile(file)
    } else {
        next()
    }
});

app.get('/files/:path(*)', async (req, res) => {
    const path = req.params.path as string;

    res.sendFile(path, { root: files });
});

app.put('/files/:path(*)', async (req, res) => {
    const path = req.params.path as string;
    await fs.writeFile(Path.join(files, path), req.body);
    res.sendStatus(200);
});

app.post('/virt_to_phys', async (req, res) => {
    const args = req.body as string[];

    const process = spawn(Path.join(tools, 'virt_to_phys.sh'), args, {
        stdio: 'pipe',
    });

    let lastLine = '';
    const output = new Array();

    function processLine(line: string) {
        const fields = line.split(' ');

        output.push({
            physical: fields[4].slice(0, -1),
            set: parseInt(fields[7].slice(0, -1), 16),
            slice: parseInt(fields[9], 16),
        });
    }

    process.stdout.on('data', (buffer: Buffer) => {
        const lines = buffer.toString('utf8').split('\n');

        lines[0] = lastLine + lines[0];
        lastLine = lines.pop()!;

        for (const line of lines) {
            processLine(line);
        }
    });
    process.stdout.on('close', () => {
        if (lastLine.trim().length !== 0) {
            processLine(lastLine);
        }

        res.header('Content-Type', 'application/json');
        res.send(JSON.stringify(output));
    });
});

app.get('/addr/:channel', async (req, res) => {
    const channel = parseInt(req.params.channel);

    const contents = await fs.readFile(path.join('output.txt'), 'utf8');

    const start = contents.lastIndexOf('RGB PID ADDR: 129 129 129');
    const end = contents.indexOf('\n', start);

    if (start === -1 || end === -1) {
        res.sendStatus(404);
        return;
    }

    const line = contents.substring(start, end).split(" ");

    const pid = line[6];
    const addr = line[7 + channel];

    const process = spawn(Path.join(tools, 'virt_to_phys'), [pid, addr], {
        stdio: 'pipe',
    });

    let data = '';
    process.stdout.on('data', (buffer: Buffer) => {
        data += buffer.toString();
    });
    process.stdout.on('close', () => {
    const fields = data.split(' ');
        const obj = {
            physical: fields[4].slice(0, -1),
            set: parseInt(fields[7].slice(0, -1), 16),
            slice: parseInt(fields[9], 16),
        };

        res.header('Content-Type', 'application/json');
        res.send(JSON.stringify(obj));
    });
});

const decompress = util.promisify(zlib.gunzip);

app.use(serve("static"));

app.get("/data", async (req, res) => {
    const base = 'output';
    const file = (await fs.readdir(base))[0];
    const path = base + "/" + file;

    let buffer = await fs.readFile(path);
    buffer = await decompress(buffer);
    res.send(buffer);
});

async function start() {
    try {
        await fs.mkdir(files);
    }
    catch {
    }

    app.listen(port, hostname, () => {
        console.log(`[SERVER] Listening on http://${hostname}:${port}/`);
    });
}
start();