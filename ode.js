const canvas = document.getElementById('odeCanvas');
const ctx = canvas.getContext('2d');
const coordinates = document.getElementById('coordinates');

// Initial view settings
const initialScale = 50;
const initialOffsetX = window.innerWidth / 2;
const initialOffsetY = window.innerHeight / 2;

// Canvas settings
let scale = initialScale;
let offsetX = initialOffsetX;
let offsetY = initialOffsetY;

// Simulation parameters
let currentFunction = (x, y) => y;
const dt = 0.01; // time step for solution
const numSteps = 1000; // number of steps for solution
const arrowDensity = 15; // spacing between arrows
const arrowLength = 10; // fixed length for all arrows
const arrowHeadLength = 4; // length of arrow head
const arrowHeadAngle = Math.PI / 6; // angle of arrow head

// Tracking states
let isPanning = false;
let isDraggingSolution = false;
let lastMouseX = 0;
let lastMouseY = 0;
let currentSolutionPoint = null;

// Theme state
let isDarkTheme = true;

// Make control panel draggable
const controlPanel = document.getElementById('control-panel');
let isDraggingPanel = false;
let currentPanelX;
let currentPanelY;
let initialPanelX;
let initialPanelY;

// Coordinate transformation functions
function canvasToMath(x, y) {
    return [(x - offsetX) / scale, -(y - offsetY) / scale];
}

function mathToCanvas(x, y) {
    return [x * scale + offsetX, -y * scale + offsetY];
}

// Resize canvas
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    drawAll();
}

// Parse and compile function from input
function updateField() {
    const input = document.getElementById('function-input').value;
    try {
        const expr = math.compile(input);
        currentFunction = (x, y) => {
            try {
                const result = expr.evaluate({ x: x, y: y });
                return isFinite(result) ? result : 0;
            } catch (e) {
                console.error('Error evaluating function:', e);
                return 0;
            }
        };
        clearFlows();  // Clear flows when updating field
        drawAll();
    } catch (e) {
        console.error('Error parsing function:', e);
        alert('Invalid function! Please check your syntax.');
    }
}

// Draw grid and axes
function drawGrid() {
    ctx.strokeStyle = isDarkTheme ? '#2a2a2a' : '#e0e0e0';
    ctx.lineWidth = 1;
    
    const gridSize = 50;
    const [xMin, yMax] = canvasToMath(0, 0);
    const [xMax, yMin] = canvasToMath(canvas.width, canvas.height);
    
    // Draw vertical grid lines
    for (let x = Math.floor(xMin); x <= Math.ceil(xMax); x++) {
        const [canvasX] = mathToCanvas(x, 0);
        ctx.beginPath();
        ctx.moveTo(canvasX, 0);
        ctx.lineTo(canvasX, canvas.height);
        ctx.stroke();
    }
    
    // Draw horizontal grid lines
    for (let y = Math.floor(yMin); y <= Math.ceil(yMax); y++) {
        const [, canvasY] = mathToCanvas(0, y);
        ctx.beginPath();
        ctx.moveTo(0, canvasY);
        ctx.lineTo(canvas.width, canvasY);
        ctx.stroke();
    }
    
    // Draw axes
    ctx.strokeStyle = isDarkTheme ? '#3a3a3a' : '#a0a0a0';
    ctx.lineWidth = 2;
    const [originX, originY] = mathToCanvas(0, 0);
    
    // x-axis
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(canvas.width, originY);
    ctx.stroke();
    
    // y-axis
    ctx.beginPath();
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, canvas.height);
    ctx.stroke();
}

// Draw direction field
function drawDirectionField() {
    const [xMin, yMax] = canvasToMath(0, 0);
    const [xMax, yMin] = canvasToMath(canvas.width, canvas.height);
    
    ctx.strokeStyle = isDarkTheme ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    
    for (let screenX = 0; screenX < canvas.width; screenX += arrowDensity) {
        for (let screenY = 0; screenY < canvas.height; screenY += arrowDensity) {
            const [x, y] = canvasToMath(screenX, screenY);
            const derivative = currentFunction(x, y);
            
            if (isFinite(derivative)) {
                // Note: we negate the angle because canvas y-axis is inverted
                const angle = -Math.atan(derivative);
                const halfLength = arrowLength / 2;
                const dx = halfLength * Math.cos(angle);
                const dy = halfLength * Math.sin(angle);
                
                const startX = screenX - dx;
                const startY = screenY - dy;
                const endX = screenX + dx;
                const endY = screenY + dy;
                
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                
                const headlen = arrowHeadLength;
                const angle1 = angle - arrowHeadAngle;
                const angle2 = angle + arrowHeadAngle;
                
                ctx.lineTo(endX - headlen * Math.cos(angle1), 
                          endY - headlen * Math.sin(angle1));
                ctx.moveTo(endX, endY);
                ctx.lineTo(endX - headlen * Math.cos(angle2),
                          endY - headlen * Math.sin(angle2));
                
                ctx.stroke();
            }
        }
    }
}

// Animation state
let activeFlows = [];
let animationFrameId = null;

// Speed control
const speedSlider = document.getElementById('speed-slider');
let flowSpeed = 0.01; // Base speed

// Convert slider value (1-100) to actual step size (0.001 to 0.05)
function updateFlowSpeed() {
    const value = speedSlider.value;
    flowSpeed = 0.001 + (value / 100) * 0.049; // Maps 1-100 to 0.001-0.05
}

speedSlider.addEventListener('input', updateFlowSpeed);
updateFlowSpeed(); // Initialize with default value

// Solver selection handling
const solverButton = document.getElementById('solver-button');
const solverOptions = document.getElementById('solver-options');
let currentSolver = 'rk4';

solverButton.addEventListener('click', () => {
    solverButton.classList.toggle('active');
    solverOptions.classList.toggle('show');
});

// Close solver options when clicking outside
document.addEventListener('click', (e) => {
    if (!solverButton.contains(e.target) && !solverOptions.contains(e.target)) {
        solverButton.classList.remove('active');
        solverOptions.classList.remove('show');
    }
});

// Handle solver selection
solverOptions.addEventListener('click', (e) => {
    const option = e.target.closest('.solver-option');
    if (option) {
        const method = option.dataset.method;
        currentSolver = method;
        solverButton.textContent = option.querySelector('div').textContent;
        
        // Update selected state
        solverOptions.querySelectorAll('.solver-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        option.classList.add('selected');
        
        // Close menu
        solverButton.classList.remove('active');
        solverOptions.classList.remove('show');
    }
});

// Numerical methods
function eulerStep(x, y, forward) {
    const sign = forward ? 1 : -1;
    const dy = currentFunction(x, y);
    if (!isFinite(dy)) return null;
    
    const newX = x + sign * flowSpeed;
    const newY = y + sign * flowSpeed * dy;
    
    if (Math.abs(newX) > 100 || Math.abs(newY) > 100 || Math.abs(dy) > 100) return null;
    return [newX, newY];
}

function heunStep(x, y, forward) {
    const sign = forward ? 1 : -1;
    const k1 = currentFunction(x, y);
    if (!isFinite(k1)) return null;
    
    const xTemp = x + sign * flowSpeed;
    const yTemp = y + sign * flowSpeed * k1;
    const k2 = currentFunction(xTemp, yTemp);
    if (!isFinite(k2)) return null;
    
    const dy = (k1 + k2) / 2;
    if (Math.abs(dy) > 100) return null;
    
    const newX = x + sign * flowSpeed;
    const newY = y + sign * flowSpeed * dy;
    
    if (Math.abs(newX) > 100 || Math.abs(newY) > 100) return null;
    return [newX, newY];
}

function rk3Step(x, y, forward) {
    const sign = forward ? 1 : -1;
    const k1 = currentFunction(x, y);
    const k2 = currentFunction(x + sign * flowSpeed/2, y + sign * flowSpeed/2 * k1);
    const k3 = currentFunction(x + sign * flowSpeed, y - sign * flowSpeed * k1 + 2 * sign * flowSpeed * k2);
    
    if (!isFinite(k1) || !isFinite(k2) || !isFinite(k3)) return null;
    
    const dy = (k1 + 4*k2 + k3) / 6;
    if (Math.abs(dy) > 100) return null;
    
    const newX = x + sign * flowSpeed;
    const newY = y + sign * flowSpeed * dy;
    
    if (Math.abs(newX) > 100 || Math.abs(newY) > 100) return null;
    return [newX, newY];
}

function rk4Step(x, y, forward) {
    const sign = forward ? 1 : -1;
    const k1 = currentFunction(x, y);
    const k2 = currentFunction(x + sign * flowSpeed/2, y + sign * flowSpeed/2 * k1);
    const k3 = currentFunction(x + sign * flowSpeed/2, y + sign * flowSpeed/2 * k2);
    const k4 = currentFunction(x + sign * flowSpeed, y + sign * flowSpeed * k3);
    
    if (!isFinite(k1) || !isFinite(k2) || !isFinite(k3) || !isFinite(k4)) return null;
    
    const dy = (k1 + 2*k2 + 2*k3 + k4) / 6;
    if (Math.abs(dy) > 100) return null;
    
    const newX = x + sign * flowSpeed;
    const newY = y + sign * flowSpeed * dy;
    
    if (Math.abs(newX) > 100 || Math.abs(newY) > 100) return null;
    return [newX, newY];
}

// Flow class to manage individual flows
class Flow {
    constructor(x0, y0) {
        this.x0 = x0;
        this.y0 = y0;
        this.forwardPoints = [[x0, y0]];
        this.backwardPoints = [[x0, y0]];
        this.forwardDone = false;
        this.backwardDone = false;
    }

    step() {
        // Forward step
        if (!this.forwardDone) {
            const lastPoint = this.forwardPoints[this.forwardPoints.length - 1];
            const nextPoint = this.computeNextPoint(lastPoint[0], lastPoint[1], true);
            if (nextPoint) {
                this.forwardPoints.push(nextPoint);
            } else {
                this.forwardDone = true;
            }
        }

        // Backward step
        if (!this.backwardDone) {
            const lastPoint = this.backwardPoints[this.backwardPoints.length - 1];
            const nextPoint = this.computeNextPoint(lastPoint[0], lastPoint[1], false);
            if (nextPoint) {
                this.backwardPoints.push(nextPoint);
            } else {
                this.backwardDone = true;
            }
        }

        return !(this.forwardDone && this.backwardDone);
    }

    computeNextPoint(x, y, forward) {
        switch (currentSolver) {
            case 'euler':
                return eulerStep(x, y, forward);
            case 'heun':
                return heunStep(x, y, forward);
            case 'rk3':
                return rk3Step(x, y, forward);
            case 'rk4':
            default:
                return rk4Step(x, y, forward);
        }
    }

    draw(ctx) {
        // Draw forward solution (green)
        ctx.strokeStyle = isDarkTheme ? '#33cc33' : '#009933';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const [startX, startY] = mathToCanvas(this.forwardPoints[0][0], this.forwardPoints[0][1]);
        ctx.moveTo(startX, startY);
        for (const point of this.forwardPoints) {
            const [x, y] = mathToCanvas(point[0], point[1]);
            ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Draw backward solution (magenta)
        ctx.strokeStyle = isDarkTheme ? '#cc33cc' : '#990099';
        ctx.beginPath();
        const [backStartX, backStartY] = mathToCanvas(this.backwardPoints[0][0], this.backwardPoints[0][1]);
        ctx.moveTo(backStartX, backStartY);
        for (const point of this.backwardPoints) {
            const [x, y] = mathToCanvas(point[0], point[1]);
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
}

// Animation loop
function animate() {
    let hasActiveFlows = false;
    
    // Step each flow
    for (const flow of activeFlows) {
        if (flow.step()) {
            hasActiveFlows = true;
        }
    }
    
    // Redraw everything
    drawAll();
    
    // Continue animation if there are active flows
    if (hasActiveFlows) {
        animationFrameId = requestAnimationFrame(animate);
    } else {
        animationFrameId = null;
    }
}

// Draw everything
function drawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawDirectionField();
    for (const flow of activeFlows) {
        flow.draw(ctx);
    }
}

// Clear all flows
function clearFlows() {
    activeFlows = [];
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    drawAll();
}

// Mouse move handler
let lastFlowTime = 0;
const FLOW_INTERVAL = 100; // Minimum time between new flows in milliseconds

canvas.addEventListener('mousemove', updateCoordinates);

function updateCoordinates(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const [mathX, mathY] = canvasToMath(x, y);
    coordinates.textContent = `(${mathX.toFixed(2)}, ${mathY.toFixed(2)})`;
}

// Clear flows on mouse up
canvas.addEventListener('mouseup', () => {
    isDraggingSolution = false;
});

// Start new flow on mouse down
canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { // Left click
        isDraggingSolution = true;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const [mathX, mathY] = canvasToMath(x, y);
        activeFlows.push(new Flow(mathX, mathY));
        
        if (!animationFrameId) {
            animate();
        }
    }
});

// Make control panel draggable
controlPanel.addEventListener('mousedown', function(e) {
    if (e.target === controlPanel || e.target.tagName === 'H1' || e.target.className === 'header') {
        isDraggingPanel = true;
        initialPanelX = e.clientX - controlPanel.offsetLeft;
        initialPanelY = e.clientY - controlPanel.offsetTop;
    }
});

document.addEventListener('mousemove', function(e) {
    if (isDraggingPanel) {
        currentPanelX = e.clientX - initialPanelX;
        currentPanelY = e.clientY - initialPanelY;
        controlPanel.style.left = currentPanelX + 'px';
        controlPanel.style.top = currentPanelY + 'px';
    }
});

document.addEventListener('mouseup', function() {
    isDraggingPanel = false;
});

// Canvas interaction
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const [mathX, mathY] = canvasToMath(x, y);

    if (e.button === 1) {
        e.preventDefault();
        isPanning = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    } else if (e.button === 0) {
        isDraggingSolution = true;
        currentSolutionPoint = [mathX, mathY];
        drawAll();
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const [mathX, mathY] = canvasToMath(x, y);
    
    if (isPanning) {
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        offsetX += dx;
        offsetY += dy;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        drawAll();
    } else if (isDraggingSolution) {
        currentSolutionPoint = [mathX, mathY];
        drawAll();
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (e.button === 1) {
        isPanning = false;
    } else if (e.button === 0) {
        isDraggingSolution = false;
    }
});

canvas.addEventListener('mouseleave', () => {
    isPanning = false;
    isDraggingSolution = false;
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

canvas.addEventListener('auxclick', (e) => {
    if (e.button === 1) e.preventDefault();
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const [mathX, mathY] = canvasToMath(mouseX, mouseY);
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    scale *= zoomFactor;
    
    const newMathX = (mouseX - offsetX) / scale;
    const newMathY = -(mouseY - offsetY) / scale;
    
    offsetX += (mathX - newMathX) * scale;
    offsetY -= (mathY - newMathY) * scale;
    
    drawAll();
});

// Theme handling
const themeBtn = document.getElementById('theme-btn');
const themeIcon = document.getElementById('theme-icon');

function toggleTheme() {
    isDarkTheme = !isDarkTheme;
    document.body.classList.toggle('light-theme');
    
    if (isDarkTheme) {
        themeIcon.innerHTML = `<path d="M12,18C11.11,18 10.26,17.8 9.5,17.45C11.56,16.5 13,14.42 13,12C13,9.58 11.56,7.5 9.5,6.55C10.26,6.2 11.11,6 12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18M20,8.69V4H15.31L12,0.69L8.69,4H4V8.69L0.69,12L4,15.31V20H8.69L12,23.31L15.31,20H20V15.31L23.31,12L20,8.69Z"/>`;
    } else {
        themeIcon.innerHTML = `<path d="M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9Z"/>`;
    }
    
    drawAll();
}

themeBtn.addEventListener('click', toggleTheme);

// Reset view function
function resetView() {
    scale = initialScale;
    offsetX = initialOffsetX;
    offsetY = initialOffsetY;
    drawAll();
}

// Add home button click handler
const homeBtn = document.getElementById('home-btn');
homeBtn.addEventListener('click', resetView);

// Add clean button click handler
const cleanBtn = document.getElementById('clean-btn');
cleanBtn.addEventListener('click', clearFlows);

// Coordinate input handling
const xCoordInput = document.getElementById('x-coord');
const yCoordInput = document.getElementById('y-coord');

function handleCoordInput(event) {
    if (event.key === 'Enter') {
        const x = parseFloat(xCoordInput.value || '0');
        const y = parseFloat(yCoordInput.value || '0');
        
        if (isFinite(x) && isFinite(y)) {
            activeFlows.push(new Flow(x, y));
            
            if (!animationFrameId) {
                animate();
            }
        }
        
        // Remove focus from input
        event.target.blur();
    }
}

// Update coordinate inputs when mouse moves
function updateCoordinates(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const [mathX, mathY] = canvasToMath(x, y);
    
    // Update input fields if they don't have focus
    if (document.activeElement !== xCoordInput && document.activeElement !== yCoordInput) {
        xCoordInput.value = mathX.toFixed(2);
        yCoordInput.value = mathY.toFixed(2);
    }
}

xCoordInput.addEventListener('keypress', handleCoordInput);
yCoordInput.addEventListener('keypress', handleCoordInput);

// Allow only numbers, decimal point, minus sign and backspace
function validateNumberInput(event) {
    const allowedKeys = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '-', 'Backspace', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'];
    if (!allowedKeys.includes(event.key)) {
        event.preventDefault();
    }
    
    // Prevent multiple decimal points
    if (event.key === '.' && event.target.value.includes('.')) {
        event.preventDefault();
    }
    
    // Prevent multiple minus signs
    if (event.key === '-' && event.target.value.includes('-')) {
        event.preventDefault();
    }
    
    // Only allow minus sign at the beginning
    if (event.key === '-' && event.target.selectionStart > 0) {
        event.preventDefault();
    }
}

xCoordInput.addEventListener('keydown', validateNumberInput);
yCoordInput.addEventListener('keydown', validateNumberInput);

// Update coordinates on mouse move
canvas.addEventListener('mousemove', updateCoordinates);

// Initialize
window.addEventListener('resize', () => {
    const oldWidth = canvas.width;
    const oldHeight = canvas.height;
    resizeCanvas();
    offsetX = offsetX * (canvas.width / oldWidth);
    offsetY = offsetY * (canvas.height / oldHeight);
    drawAll();
});

resizeCanvas();
updateField();
