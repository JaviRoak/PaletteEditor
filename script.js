// DOM Elements
const imageInput = document.getElementById('imageInput');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const placeholder = document.querySelector('.placeholder');
const controlsDiv = document.querySelector('.controls');
const downloadBtn = document.getElementById('downloadBtn');

// Control Elements
const brightness = document.getElementById('brightness');
const contrast = document.getElementById('contrast');
const saturation = document.getElementById('saturation');
const hue = document.getElementById('hue');
const rotation = document.getElementById('rotation');
const opacity = document.getElementById('opacity');

const brightnessValue = document.getElementById('brightnessValue');
const contrastValue = document.getElementById('contrastValue');
const saturationValue = document.getElementById('saturationValue');
const hueValue = document.getElementById('hueValue');
const rotationValue = document.getElementById('rotationValue');
const opacityValue = document.getElementById('opacityValue');

// Drawing Tool Elements
const drawTool = document.getElementById('drawTool');
const drawColor = document.getElementById('drawColor');
const gradientColor = document.getElementById('gradientColor');
const useGradient = document.getElementById('useGradient');
const strokeWidth = document.getElementById('strokeWidth');
const drawOpacity = document.getElementById('drawOpacity');
const fillShape = document.getElementById('fillShape');
const undoBtn = document.getElementById('undoBtn');
const clearDrawingBtn = document.getElementById('clearDrawingBtn');

const strokeValue = document.getElementById('strokeValue');
const drawOpacityValue = document.getElementById('drawOpacityValue');

// Effects Elements
const vignette = document.getElementById('vignette');
const vignetteIntensity = document.getElementById('vignetteIntensity');
const vignetteGroup = document.getElementById('vignetteGroup');
const vignetteValue = document.getElementById('vignetteValue');

const borderType = document.getElementById('borderType');
const borderColor = document.getElementById('borderColor');
const borderWidth = document.getElementById('borderWidth');
const borderGroup = document.getElementById('borderGroup');
const borderWidthValue = document.getElementById('borderWidthValue');

const resetBtn = document.getElementById('resetBtn');

// State
let originalImage = null;
let currentImage = null;
let offscreenCanvas = null;
let offscreenCtx = null;
let drawingHistory = [];
let isDrawing = false;
let startX = 0;
let startY = 0;
let currentX = 0;
let currentY = 0;
let freehandPoints = [];

// Event Listeners
imageInput.addEventListener('change', handleImageUpload);

brightness.addEventListener('input', (e) => {
    brightnessValue.textContent = e.target.value + '%';
    redraw();
});

contrast.addEventListener('input', (e) => {
    contrastValue.textContent = e.target.value + '%';
    redraw();
});

saturation.addEventListener('input', (e) => {
    saturationValue.textContent = e.target.value + '%';
    redraw();
});

hue.addEventListener('input', (e) => {
    hueValue.textContent = e.target.value + '°';
    redraw();
});

rotation.addEventListener('input', (e) => {
    rotationValue.textContent = e.target.value + '°';
    redraw();
});

opacity.addEventListener('input', (e) => {
    opacityValue.textContent = e.target.value + '%';
    redraw();
});

strokeWidth.addEventListener('input', (e) => {
    strokeValue.textContent = e.target.value;
});

drawOpacity.addEventListener('input', (e) => {
    drawOpacityValue.textContent = e.target.value + '%';
});

vignette.addEventListener('change', (e) => {
    vignetteGroup.style.display = e.target.checked ? 'block' : 'none';
    redraw();
});

vignetteIntensity.addEventListener('input', (e) => {
    vignetteValue.textContent = e.target.value + '%';
    redraw();
});

borderType.addEventListener('change', (e) => {
    borderGroup.style.display = e.target.value !== 'none' ? 'block' : 'none';
    redraw();
});

borderColor.addEventListener('change', redraw);
borderWidth.addEventListener('input', (e) => {
    borderWidthValue.textContent = e.target.value + 'px';
    redraw();
});

undoBtn.addEventListener('click', undo);
clearDrawingBtn.addEventListener('click', clearDrawing);
resetBtn.addEventListener('click', resetEdits);
downloadBtn.addEventListener('click', downloadImage);

// Canvas Drawing Events
canvas.addEventListener('pointerdown', startDrawing);
canvas.addEventListener('pointermove', draw);
canvas.addEventListener('pointerup', stopDrawing);
canvas.addEventListener('pointerleave', stopDrawing);
window.addEventListener('pointerup', stopDrawing);

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            originalImage = img;
            currentImage = img;

            canvas.classList.add('active');
            placeholder.style.display = 'none';
            controlsDiv.classList.add('active');
            downloadBtn.disabled = false;

            canvas.width = img.width;
            canvas.height = img.height;

            offscreenCanvas = null;
            drawingHistory = [];
            saveDrawingState();
            redraw();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function getCanvasCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (e.offsetX !== undefined && e.offsetY !== undefined) {
        return {
            x: e.offsetX * scaleX,
            y: e.offsetY * scaleY
        };
    }

    let clientX;
    let clientY;

    if (e.touches && e.touches.length) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

function startDrawing(e) {
    e.preventDefault();
    if (drawTool.value === 'none' || !currentImage) return;
    
    saveDrawingState();
    isDrawing = true;
    const coords = getCanvasCoordinates(e);
    startX = coords.x;
    startY = coords.y;
    currentX = startX;
    currentY = startY;

    if (e.pointerId !== undefined && canvas.setPointerCapture) {
        canvas.setPointerCapture(e.pointerId);
    }

    if (drawTool.value === 'freehand') {
        freehandPoints = [{ x: startX, y: startY }];
    }
}

function draw(e) {
    if (!isDrawing || drawTool.value === 'none' || !currentImage) return;
    
    const coords = getCanvasCoordinates(e);
    currentX = coords.x;
    currentY = coords.y;

    // Redraw from saved state
    redraw();

    // Draw preview
    if (drawTool.value === 'freehand') {
        freehandPoints.push({ x: currentX, y: currentY });
        setupDrawStyle(startX, startY, currentX, currentY);
        ctx.beginPath();
        ctx.moveTo(freehandPoints[0].x, freehandPoints[0].y);
        for (let i = 1; i < freehandPoints.length; i++) {
            ctx.lineTo(freehandPoints[i].x, freehandPoints[i].y);
        }
        ctx.stroke();
    } else {
        setupDrawStyle(startX, startY, currentX, currentY);
        drawShape(startX, startY, currentX, currentY, true);
    }
}

function stopDrawing(e) {
    if (!isDrawing) return;
    isDrawing = false;

    if (e && e.pointerId !== undefined && canvas.releasePointerCapture) {
        canvas.releasePointerCapture(e.pointerId);
    }

    if (drawTool.value === 'freehand') {
        redraw();
        if (freehandPoints.length > 1) {
            setupDrawStyle(freehandPoints[0].x, freehandPoints[0].y, freehandPoints[freehandPoints.length - 1].x, freehandPoints[freehandPoints.length - 1].y);
            ctx.beginPath();
            ctx.moveTo(freehandPoints[0].x, freehandPoints[0].y);
            for (let i = 1; i < freehandPoints.length; i++) {
                ctx.lineTo(freehandPoints[i].x, freehandPoints[i].y);
            }
            ctx.stroke();
            saveDrawingState();
        }
        freehandPoints = [];
    } else if (drawTool.value !== 'none') {
        redraw();
        setupDrawStyle(startX, startY, currentX, currentY);
        drawShape(startX, startY, currentX, currentY, false);
        saveDrawingState();
    }
}

function setupDrawStyle(x1 = startX, y1 = startY, x2 = currentX, y2 = currentY) {
    const color = drawColor.value;
    const opacity = drawOpacity.value / 100;
    const stroke = parseInt(strokeWidth.value);

    ctx.globalAlpha = opacity;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = stroke;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (useGradient.checked) {
        let gx1 = x1;
        let gy1 = y1;
        let gx2 = x2;
        let gy2 = y2;

        if (drawTool.value === 'rectangle' || drawTool.value === 'circle') {
            gx1 = Math.min(x1, x2);
            gy1 = Math.min(y1, y2);
            gx2 = gx1;
            gy2 = Math.max(y1, y2);
        }

        if (drawTool.value === 'line') {
            gx1 = x1;
            gy1 = y1;
            gx2 = x2;
            gy2 = y2;
        }

        if (gx1 === gx2 && gy1 === gy2) {
            gx2 = gx1 + 1;
            gy2 = gy1 + 1;
        }

        const gradient = ctx.createLinearGradient(gx1, gy1, gx2, gy2);
        gradient.addColorStop(0, drawColor.value);
        gradient.addColorStop(1, gradientColor.value);
        ctx.fillStyle = gradient;
        ctx.strokeStyle = gradient;
    }
}

function drawShape(x1, y1, x2, y2, preview = false) {
    let x = x1;
    let y = y1;
    let width = x2 - x1;
    let height = y2 - y1;

    if (drawTool.value === 'rectangle') {
        if (width < 0) {
            x = x2;
            width = Math.abs(width);
        }
        if (height < 0) {
            y = y2;
            height = Math.abs(height);
        }
    }

    ctx.save();
    if (drawTool.value === 'rectangle') {
        if (fillShape.checked) {
            ctx.fillRect(x, y, width, height);
        }
        ctx.strokeRect(x, y, width, height);
    } else if (drawTool.value === 'circle') {
        const radius = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        ctx.beginPath();
        ctx.arc(x1, y1, radius, 0, Math.PI * 2);
        if (fillShape.checked) {
            ctx.fill();
        }
        ctx.stroke();
    } else if (drawTool.value === 'line') {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }
    ctx.restore();
}

function saveDrawingState() {
    if (!canvas.width || !canvas.height) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    drawingHistory.push(imageData);
}

function undo() {
    if (drawingHistory.length > 1) {
        drawingHistory.pop();
        const lastState = drawingHistory[drawingHistory.length - 1];
        ctx.putImageData(lastState, 0, 0);
    }
}

function clearDrawing() {
    if (confirm('Clear all drawings?')) {
        drawingHistory = [];
        saveDrawingState();
        redraw();
    }
}

function redraw() {
    if (!currentImage) return;

    const brightnessVal = brightness.value / 100;
    const contrastVal = contrast.value / 100;
    const saturationVal = saturation.value / 100;
    const hueVal = hue.value;
    const rotationVal = rotation.value;
    const opacityVal = opacity.value / 100;

    if (!offscreenCanvas) {
        offscreenCanvas = document.createElement('canvas');
        offscreenCtx = offscreenCanvas.getContext('2d');
    }

    offscreenCanvas.width = canvas.width;
    offscreenCanvas.height = canvas.height;

    offscreenCtx.drawImage(currentImage, 0, 0);

    const imageData = offscreenCtx.getImageData(0, 0, offscreenCanvas.width, offscreenCanvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];
        const a = data[i + 3];

        r = Math.min(255, Math.max(0, r * brightnessVal));
        g = Math.min(255, Math.max(0, g * brightnessVal));
        b = Math.min(255, Math.max(0, b * brightnessVal));

        r = Math.min(255, Math.max(0, (r - 128) * contrastVal + 128));
        g = Math.min(255, Math.max(0, (g - 128) * contrastVal + 128));
        b = Math.min(255, Math.max(0, (b - 128) * contrastVal + 128));

        let hsl = rgbToHsl(r, g, b);
        hsl[0] = (hsl[0] + parseFloat(hueVal)) % 360;
        hsl[1] = Math.min(100, hsl[1] * saturationVal);
        let rgb = hslToRgb(hsl[0], hsl[1], hsl[2]);

        data[i] = rgb[0];
        data[i + 1] = rgb[1];
        data[i + 2] = rgb[2];
        data[i + 3] = a;
    }

    offscreenCtx.putImageData(imageData, 0, 0);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.globalAlpha = opacityVal;

    if (rotationVal !== 0) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotationVal * Math.PI) / 180);
        ctx.drawImage(offscreenCanvas, -canvas.width / 2, -canvas.height / 2);
    } else {
        ctx.drawImage(offscreenCanvas, 0, 0);
    }

    ctx.restore();
    ctx.globalAlpha = 1;

    // Apply effects
    if (vignette.checked) {
        applyVignette();
    }

    if (borderType.value !== 'none') {
        applyBorder();
    }

    // Restore drawing history
    if (drawingHistory.length > 0) {
        const lastDrawing = drawingHistory[drawingHistory.length - 1];
        
        // Get only the drawn pixels
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(lastDrawing, 0, 0);
        
        // Composite the drawing on top
        ctx.drawImage(tempCanvas, 0, 0);
    }
}

function applyVignette() {
    const intensity = vignetteIntensity.value / 100;
    const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) / 1.5
    );

    gradient.addColorStop(0, `rgba(0, 0, 0, 0)`);
    gradient.addColorStop(1, `rgba(0, 0, 0, ${intensity})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function applyBorder() {
    const size = parseInt(borderWidth.value);
    const color = borderColor.value;

    ctx.strokeStyle = color;
    ctx.lineWidth = size;

    if (borderType.value === 'solid') {
        ctx.strokeRect(size / 2, size / 2, canvas.width - size, canvas.height - size);
    } else if (borderType.value === 'double') {
        const offset = size / 3;
        ctx.strokeRect(offset, offset, canvas.width - offset * 2, canvas.height - offset * 2);
        ctx.strokeRect(size + offset, size + offset, canvas.width - (size + offset) * 2, canvas.height - (size + offset) * 2);
    }
}

function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    return [h * 360, s * 100, l * 100];
}

function hslToRgb(h, s, l) {
    h /= 360;
    s /= 100;
    l /= 100;

    let r, g, b;

    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;

        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function resetEdits() {
    brightness.value = 100;
    contrast.value = 100;
    saturation.value = 100;
    hue.value = 0;
    rotation.value = 0;
    opacity.value = 100;

    brightnessValue.textContent = '100%';
    contrastValue.textContent = '100%';
    saturationValue.textContent = '100%';
    hueValue.textContent = '0°';
    rotationValue.textContent = '0°';
    opacityValue.textContent = '100%';

    drawTool.value = 'none';
    vignette.checked = false;
    vignetteGroup.style.display = 'none';
    borderType.value = 'none';
    borderGroup.style.display = 'none';

    drawingHistory = [];
    saveDrawingState();
    redraw();
}

function downloadImage() {
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = 'edited-image.png';
    link.click();
}
