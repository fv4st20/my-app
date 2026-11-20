import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Plus, Trash2, AlertCircle } from 'lucide-react';
import './index.css';

const GATE_TYPES = {
  INPUT: { name: 'Input', inputs: 0 },
  OUTPUT: { name: 'Output', inputs: 1 },
  AND: { name: 'AND', inputs: 2 },
  OR: { name: 'OR', inputs: 2 },
  NOT: { name: 'NOT', inputs: 1 },
  NAND: { name: 'NAND', inputs: 2 },
  NOR: { name: 'NOR', inputs: 2 },
  XOR: { name: 'XOR', inputs: 2 },
  XNOR: { name: 'XNOR', inputs: 2 }
};

const NODE_WIDTH = 120;
const NODE_HEIGHT = 80;
const STORAGE_KEY = 'nond_ex_circuit_v1';

let nextUidCounter = 1;
function createUniqueId(prefix = 'item') {
  nextUidCounter += 1;
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${nextUidCounter}`;
}

function getCascadePosition(index) {
  const w = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const h = typeof window !== 'undefined' ? window.innerHeight : 768;
  const col = index % 5;
  const row = Math.floor(index / 5) % 5;
  const x = Math.max(180, Math.min(w - NODE_WIDTH - 24, Math.round(w / 2 - 120 + col * 36)));
  const y = Math.max(90, Math.min(h - NODE_HEIGHT - 24, Math.round(h / 2 - 100 + row * 32)));
  return { x, y };
}

const evaluateGate = (type, inputs) => {
  const [a = false, b = false] = inputs;
  switch (type) {
    case 'AND':
      return Boolean(a && b);
    case 'OR':
      return Boolean(a || b);
    case 'NOT':
      return !a;
    case 'NAND':
      return !(a && b);
    case 'NOR':
      return !(a || b);
    case 'XOR':
      return Boolean(a) !== Boolean(b);
    case 'XNOR':
      return Boolean(a) === Boolean(b);
    case 'OUTPUT':
      return Boolean(a);
    default:
      return false;
  }
};

// Pure synchronous circuit evaluator supporting deep gate chains and feedback oscillation detection
function computeCircuit(nodesList, wiresList) {
  if (nodesList.length === 0) {
    return { nodes: nodesList, oscillating: false };
  }

  let currentNodes = nodesList.map((n) => ({
    ...n,
    inValues: Array.isArray(n.inValues)
      ? n.inValues.slice(0, GATE_TYPES[n.type]?.inputs || 0)
      : Array(GATE_TYPES[n.type]?.inputs || 0).fill(false)
  }));

  const maxIterations = Math.max(currentNodes.length + 4, 32);
  let stabilized = false;

  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;
    const nodeById = new Map(currentNodes.map((n) => [n.id, n]));

    currentNodes = currentNodes.map((node) => {
      const gateDef = GATE_TYPES[node.type];
      if (!gateDef || node.type === 'INPUT') {
        return node;
      }

      const inputValues = Array(gateDef.inputs).fill(false);
      for (const w of wiresList) {
        if (w.to === node.id && Number.isInteger(w.toPin) && w.toPin >= 0 && w.toPin < gateDef.inputs) {
          const sourceNode = nodeById.get(w.from);
          if (sourceNode) {
            inputValues[w.toPin] = Boolean(sourceNode.outValue);
          }
        }
      }

      const newValue = evaluateGate(node.type, inputValues);
      const inputsChanged =
        !node.inValues ||
        node.inValues.length !== inputValues.length ||
        inputValues.some((v, idx) => v !== node.inValues[idx]);

      if (node.outValue !== newValue || inputsChanged) {
        if (node.outValue !== newValue) {
          changed = true;
        }
        return { ...node, outValue: newValue, inValues: inputValues };
      }
      return node;
    });

    if (!changed) {
      stabilized = true;
      break;
    }
  }

  return { nodes: currentNodes, oscillating: !stabilized };
}

function loadSavedCircuit() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { nodes: [], wires: [], oscillating: false };
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { nodes: [], wires: [], oscillating: false };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.wires)) {
      return { nodes: [], wires: [], oscillating: false };
    }

    const validNodes = parsed.nodes
      .filter(
        (n) =>
          n &&
          typeof n.id === 'string' &&
          Object.prototype.hasOwnProperty.call(GATE_TYPES, n.type) &&
          Number.isFinite(n.x) &&
          Number.isFinite(n.y)
      )
      .map((n) => ({
        id: n.id,
        type: n.type,
        x: n.x,
        y: n.y,
        outValue: Boolean(n.outValue),
        inValues: Array(GATE_TYPES[n.type].inputs).fill(false)
      }));

    const nodeMap = new Map(validNodes.map((n) => [n.id, n]));
    const validWires = parsed.wires.filter((w) => {
      if (!w || typeof w.id !== 'string' || w.from === w.to) return false;
      const fromNode = nodeMap.get(w.from);
      const toNode = nodeMap.get(w.to);
      if (!fromNode || !toNode || fromNode.type === 'OUTPUT') return false;
      const maxPins = GATE_TYPES[toNode.type].inputs;
      return Number.isInteger(w.toPin) && w.toPin >= 0 && w.toPin < maxPins;
    });

    const evaluated = computeCircuit(validNodes, validWires);
    return { nodes: evaluated.nodes, wires: validWires, oscillating: evaluated.oscillating };
  } catch {
    return { nodes: [], wires: [], oscillating: false };
  }
}

function App() {
  const workspaceRef = useRef(null);
  const [circuit, setCircuit] = useState(loadSavedCircuit);
  const { nodes, wires, oscillating } = circuit;

  const [draggedNode, setDraggedNode] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [drawingWire, setDrawingWire] = useState(null); // { fromNode: id, mouse: {x,y} }

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, wires }));
      }
    } catch {
      // Ignore quota / storage errors
    }
  }, [nodes, wires]);

  const getRelativePoint = useCallback((clientX, clientY) => {
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY, width: window.innerWidth, height: window.innerHeight };
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
      width: rect.width,
      height: rect.height
    };
  }, []);

  // Ensure drag/wire state resets even if pointer is released outside browser viewport
  useEffect(() => {
    if (!draggedNode && !drawingWire) return undefined;

    const handleGlobalCancel = () => {
      setDraggedNode(null);
      setDrawingWire(null);
    };

    window.addEventListener('pointercancel', handleGlobalCancel);
    window.addEventListener('blur', handleGlobalCancel);
    return () => {
      window.removeEventListener('pointercancel', handleGlobalCancel);
      window.removeEventListener('blur', handleGlobalCancel);
    };
  }, [draggedNode, drawingWire]);

  const addNode = (type) => {
    if (!Object.prototype.hasOwnProperty.call(GATE_TYPES, type)) return;
    setCircuit((prev) => {
      const pos = getCascadePosition(prev.nodes.length);
      const rawNode = {
        id: createUniqueId('node'),
        type,
        x: pos.x,
        y: pos.y,
        outValue: false,
        inValues: Array(GATE_TYPES[type].inputs).fill(false)
      };
      const nextNodes = [...prev.nodes, rawNode];
      const evaluated = computeCircuit(nextNodes, prev.wires);
      return { nodes: evaluated.nodes, wires: prev.wires, oscillating: evaluated.oscillating };
    });
  };

  const removeNode = (id) => {
    setCircuit((prev) => {
      const nextNodes = prev.nodes.filter((n) => n.id !== id);
      const nextWires = prev.wires.filter((w) => w.from !== id && w.to !== id);
      const evaluated = computeCircuit(nextNodes, nextWires);
      return { nodes: evaluated.nodes, wires: nextWires, oscillating: evaluated.oscillating };
    });
  };

  const toggleInput = (id) => {
    setCircuit((prev) => {
      const toggled = prev.nodes.map((n) =>
        n.id === id && n.type === 'INPUT' ? { ...n, outValue: !n.outValue } : n
      );
      const evaluated = computeCircuit(toggled, prev.wires);
      return { nodes: evaluated.nodes, wires: prev.wires, oscillating: evaluated.oscillating };
    });
  };

  const deleteWire = (id) => {
    setCircuit((prev) => {
      const nextWires = prev.wires.filter((w) => w.id !== id);
      const evaluated = computeCircuit(prev.nodes, nextWires);
      return { nodes: evaluated.nodes, wires: nextWires, oscillating: evaluated.oscillating };
    });
  };

  const clearBoard = () => {
    setDraggedNode(null);
    setDrawingWire(null);
    setCircuit({ nodes: [], wires: [], oscillating: false });
  };

  const handlePointerDown = (e, id) => {
    if (e.button !== 0) return;
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    const pt = getRelativePoint(e.clientX, e.clientY);
    setDraggedNode(id);
    setDragOffset({ x: pt.x - node.x, y: pt.y - node.y });
    e.stopPropagation();
  };

  const handlePointerMove = (e) => {
    if (!draggedNode && !drawingWire) return;
    const pt = getRelativePoint(e.clientX, e.clientY);

    if (draggedNode) {
      const maxX = Math.max(0, pt.width - NODE_WIDTH);
      const maxY = Math.max(0, pt.height - NODE_HEIGHT);
      const clampedX = Math.min(maxX, Math.max(0, pt.x - dragOffset.x));
      const clampedY = Math.min(maxY, Math.max(0, pt.y - dragOffset.y));

      setCircuit((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => (n.id === draggedNode ? { ...n, x: clampedX, y: clampedY } : n))
      }));
    } else if (drawingWire) {
      setDrawingWire((prev) => (prev ? { ...prev, mouse: { x: pt.x, y: pt.y } } : null));
    }
  };

  const handlePointerUp = (e) => {
    setDraggedNode(null);
    if (drawingWire) {
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const pinEl = elements.find((el) => el.classList && el.classList.contains('pin-in'));

      if (pinEl) {
        const toNodeId = pinEl.getAttribute('data-nodeid');
        const toPinIndex = Number.parseInt(pinEl.getAttribute('data-pinindex') || '', 10);

        setCircuit((prev) => {
          const toNode = prev.nodes.find((n) => n.id === toNodeId);
          const fromNode = prev.nodes.find((n) => n.id === drawingWire.fromNode);
          if (!toNode || !fromNode || fromNode.type === 'OUTPUT' || drawingWire.fromNode === toNodeId) {
            return prev;
          }
          const maxPins = GATE_TYPES[toNode.type]?.inputs || 0;
          if (!Number.isInteger(toPinIndex) || toPinIndex < 0 || toPinIndex >= maxPins) {
            return prev;
          }

          const filteredWires = prev.wires.filter((w) => !(w.to === toNodeId && w.toPin === toPinIndex));
          const nextWires = [
            ...filteredWires,
            {
              id: createUniqueId('wire'),
              from: drawingWire.fromNode,
              to: toNodeId,
              toPin: toPinIndex
            }
          ];
          const evaluated = computeCircuit(prev.nodes, nextWires);
          return { nodes: evaluated.nodes, wires: nextWires, oscillating: evaluated.oscillating };
        });
      }
      setDrawingWire(null);
    }
  };

  const startWire = (e, nodeId) => {
    e.stopPropagation();
    const pt = getRelativePoint(e.clientX, e.clientY);
    setDrawingWire({ fromNode: nodeId, mouse: { x: pt.x, y: pt.y } });
  };

  const createBezierPath = (startX, startY, endX, endY) => {
    const delta = Math.max(40, Math.abs(endX - startX) * 0.5);
    return `M ${startX} ${startY} C ${startX + delta} ${startY}, ${endX - delta} ${endY}, ${endX} ${endY}`;
  };

  return (
    <div
      ref={workspaceRef}
      className="workspace"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="header">
        <a href="/" aria-label="Return to Hub" style={{ color: 'var(--text)', textDecoration: 'none' }}>
          <ArrowLeft />
        </a>
        <h2>nond_ex Simulator</h2>
        {oscillating && (
          <span
            title="Feedback loop oscillates without settling to a steady state"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.78rem',
              padding: '4px 8px',
              borderRadius: '6px',
              background: 'rgba(245, 158, 11, 0.2)',
              border: '1px solid rgba(245, 158, 11, 0.5)',
              color: '#fde68a'
            }}
          >
            <AlertCircle size={14} /> Unstable Loop
          </span>
        )}
        <button type="button" className="btn" style={{ marginLeft: 'auto' }} onClick={clearBoard}>
          Clear Board
        </button>
      </div>

      <div className="toolbox">
        <h3 style={{ fontSize: '0.9rem', marginBottom: '5px', color: 'var(--wire)' }}>Components</h3>
        {Object.keys(GATE_TYPES).map((type) => (
          <button type="button" key={type} className="btn" onClick={() => addNode(type)}>
            <Plus size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }} />{' '}
            {GATE_TYPES[type].name}
          </button>
        ))}
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: '14px',
          right: '16px',
          zIndex: 50,
          fontSize: '0.75rem',
          color: '#94a3b8',
          background: 'rgba(15, 23, 42, 0.78)',
          padding: '6px 12px',
          borderRadius: '8px',
          border: '1px solid var(--node-border)',
          pointerEvents: 'none'
        }}
      >
        Drag right pin → left pin to wire • Right-click or double-click wire to remove
      </div>

      <svg className="wire-svg">
        {wires.map((wire) => {
          const fromNode = nodes.find((n) => n.id === wire.from);
          const toNode = nodes.find((n) => n.id === wire.to);
          if (!fromNode || !toNode) return null;

          const startX = fromNode.x + NODE_WIDTH;
          const startY = fromNode.y + NODE_HEIGHT / 2;

          const toPins = GATE_TYPES[toNode.type].inputs;
          const endX = toNode.x;
          let endY = toNode.y + NODE_HEIGHT / 2;
          if (toPins === 2) {
            endY = toNode.y + (wire.toPin === 0 ? 25 : 55);
          }

          const isActive = Boolean(fromNode.outValue);

          return (
            <g
              key={wire.id}
              onDoubleClick={(e) => {
                e.stopPropagation();
                deleteWire(wire.id);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                deleteWire(wire.id);
              }}
              style={{ cursor: 'pointer' }}
            >
              <path
                d={createBezierPath(startX, startY, endX, endY)}
                style={{ stroke: 'transparent', strokeWidth: 20, fill: 'none', pointerEvents: 'stroke' }}
              />
              <path
                className={`wire ${isActive ? 'active' : ''}`}
                d={createBezierPath(startX, startY, endX, endY)}
                style={{ pointerEvents: 'none' }}
              />
            </g>
          );
        })}

        {drawingWire &&
          (() => {
            const fromNode = nodes.find((n) => n.id === drawingWire.fromNode);
            if (!fromNode) return null;
            const startX = fromNode.x + NODE_WIDTH;
            const startY = fromNode.y + NODE_HEIGHT / 2;
            return (
              <path
                className="wire drawing active"
                d={createBezierPath(startX, startY, drawingWire.mouse.x, drawingWire.mouse.y)}
              />
            );
          })()}
      </svg>

      {nodes.map((node) => {
        const typeInfo = GATE_TYPES[node.type];
        if (!typeInfo) return null;
        const isActive = Boolean(node.outValue);

        return (
          <div
            key={node.id}
            className={`logic-node ${isActive && typeInfo.inputs > 0 ? 'active-output' : ''}`}
            style={{ left: node.x, top: node.y, zIndex: draggedNode === node.id ? 10 : 1 }}
            onPointerDown={(e) => handlePointerDown(e, node.id)}
          >
            <div className="node-title">{typeInfo.name}</div>

            {node.type === 'INPUT' && (
              <button
                type="button"
                aria-label={`Toggle input (${isActive ? '1' : '0'})`}
                style={{
                  marginTop: '5px',
                  padding: '4px 12px',
                  background: isActive ? 'var(--accent)' : '#1e293b',
                  color: isActive ? '#000' : '#fff',
                  border: '2px solid #000',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: '0.2s',
                  fontWeight: 'bold'
                }}
                onClick={() => toggleInput(node.id)}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {isActive ? '1' : '0'}
              </button>
            )}

            {node.type === 'OUTPUT' && (
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  margin: '5px auto 0',
                  borderRadius: '50%',
                  background: isActive ? 'var(--accent)' : '#1e293b',
                  boxShadow: isActive ? '0 0 20px var(--accent-glow)' : 'none',
                  transition: '0.2s'
                }}
              />
            )}

            <button
              type="button"
              aria-label={`Delete ${typeInfo.name} node`}
              onClick={() => removeNode(node.id)}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: '-10px',
                right: '-10px',
                background: 'var(--bg-color)',
                border: '1px solid var(--node-border)',
                borderRadius: '50%',
                padding: '4px',
                color: 'var(--text)',
                cursor: 'pointer'
              }}
            >
              <Trash2 size={12} />
            </button>

            {/* Input Pins */}
            {typeInfo.inputs === 1 && (
              <div
                className={`pin pin-in ${node.inValues?.[0] ? 'active' : ''}`}
                data-nodeid={node.id}
                data-pinindex="0"
              />
            )}
            {typeInfo.inputs === 2 && (
              <>
                <div
                  className={`pin pin-in pin-in-1 ${node.inValues?.[0] ? 'active' : ''}`}
                  data-nodeid={node.id}
                  data-pinindex="0"
                />
                <div
                  className={`pin pin-in pin-in-2 ${node.inValues?.[1] ? 'active' : ''}`}
                  data-nodeid={node.id}
                  data-pinindex="1"
                />
              </>
            )}

            {/* Output Pin */}
            {node.type !== 'OUTPUT' && (
              <div
                className={`pin pin-out ${isActive ? 'active' : ''}`}
                onPointerDown={(e) => startWire(e, node.id)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default App;
