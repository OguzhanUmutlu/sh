export function ansi256ToRgb(code: number) {
    if (code < 0 || code > 255) throw new RangeError("ANSI code must be between 0 and 255");

    if (code < 16) return [
        [0, 0, 0], [128, 0, 0], [0, 128, 0], [128, 128, 0],
        [0, 0, 128], [128, 0, 128], [0, 128, 128], [192, 192, 192],
        [128, 128, 128], [255, 0, 0], [0, 255, 0], [255, 255, 0],
        [0, 0, 255], [255, 0, 255], [0, 255, 255], [255, 255, 255]
    ][code];

    if (code >= 16 && code <= 231) {
        const level = [0, 95, 135, 175, 215, 255];
        const idx = code - 16;
        const r = level[Math.floor(idx / 36) % 6];
        const g = level[Math.floor(idx / 6) % 6];
        const b = level[idx % 6];
        return [r, g, b];
    }

    const gray = 8 + (code - 232) * 10;
    return [gray, gray, gray];
}

export function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function pickPromise<T>(promises: Promise<T>[]): Promise<[T, number]> {
    return new Promise((resolve, reject) => {
        promises.forEach((p, i) => p.then(v => resolve([v, i])).catch(reject));
    });
}