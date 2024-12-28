# ODE Flow Simulator

An interactive web-based simulator for visualizing ordinary differential equations (ODEs) and their solution flows.

## Features

- Interactive direction field visualization
- Multiple numerical solvers (RK4, RK3, Heun, Euler)
- Dynamic flow animations
- Adjustable flow speed
- Dark/light theme
- Precise coordinate input
- Pan and zoom controls

## Usage

1. Enter a differential equation in the form dy/dx = f(x,y)
2. Click anywhere on the canvas to see solution curves
3. Use the speed slider to adjust flow animation speed
4. Choose different numerical methods to compare accuracy
5. Type exact coordinates to plot specific points
6. Use mouse wheel to zoom and drag to pan

## Examples

Try these equations:
- `y^2 - x^2` (Saddle point)
- `x/y` (Hyperbolas)
- `sin(x) + y^2` (Periodic behavior)
- `-y` (Exponential decay)

## Technical Details

Built using:
- HTML5 Canvas for rendering
- math.js for expression parsing
- Vanilla JavaScript
