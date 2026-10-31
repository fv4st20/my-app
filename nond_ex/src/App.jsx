import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
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

const evaluateGate = (type, inputs) => {
  const [a = false, b = false] = inputs;
  switch (type) {
    case 'AND': return a && b;
    case 'OR': return a || b;
    case 'NOT': return !a;
    case 'NAND': return !(a && b);
    case 'NOR': return !(a || b);
    case 'XOR': return a !== b;
    case 'XNOR': return a === b;
    case 'OUTPUT': return a;
    default: return false;
  }
};

function App() {
  const [nodes, setNodes] = useState([]);
  const [wires, setWires] = useState([]);
  
  const [draggedNode, setDraggedNode] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const [drawingWire, setDrawingWire] = useState(null); // { fromNode: id, mouse: {x,y} }

  // Logic Engine Evaluation
  const evaluateCircuit = useCallback(() => {
    setNodes(prevNodes => {
      let currentNodes = [...prevNodes];
      
      // Run multiple iterations to allow signals to propagate through multiple gates
      for (let iter = 0; iter < 10; iter++) {
        let changed = false;
        
        currentNodes = currentNodes.map(node => {
          if (node.type === 'INPUT') return node; // Inputs are driven by user

          // Gather input values from wires
          const inputValues = Array(GATE_TYPES[node.type].inputs).fill(false);
          
          wires.filter(w => w.to === node.id).forEach(w => {
            const sourceNode = currentNodes.find(n => n.id === w.from);
            if (sourceNode) {
              inputValues[w.toPin] = sourceNode.outValue || false;
            }
          });

          const newValue = evaluateGate(node.type, inputValues);
          
          if (node.outValue !== newValue) {
            changed = true;
            return { ...node, outValue: newValue, inValues: inputValues };
          }
          return { ...node, inValues: inputValues };
        });

        if (!changed) break; // Steady state reached
      }
      return currentNodes;
    });
  }, [wires]);

  useEffect(() => {
    evaluateCircuit();
  }, [wires, evaluateCircuit]);

  const addNode = (type) => {
    const newNode = {
      id: Date.now().toString(),
      type,
      x: window.innerWidth / 2 - 50 + (Math.random() * 50 - 25),
      y: window.innerHeight / 2 - 50 + (Math.random() * 50 - 25),
      outValue: false,
      inValues: Array(GATE_TYPES[type].inputs).fill(false)
    };
    setNodes([...nodes, newNode]);
  };

  const removeNode = (id) => {
    setNodes(nodes.filter(n => n.id !== id));
    setWires(wires.filter(w => w.from !== id && w.to !== id));
  };

  const toggleInput = (id) => {
    setNodes(nodes.map(n => n.id === id ? { ...n, outValue: !n.outValue } : n));
    setTimeout(evaluateCircuit, 0);
  };

  const handlePointerDown = (e, id) => {
    if (e.button !== 0) return; // Only left click
    const node = nodes.find(n => n.id === id);
    setDraggedNode(id);
    setDragOffset({ x: e.clientX - node.x, y: e.clientY - node.y });
    e.stopPropagation();
  };

  const handlePointerMove = (e) => {
    if (draggedNode) {
      setNodes(nodes.map(n => 
        n.id === draggedNode ? { ...n, x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y } : n
      ));
    } else if (drawingWire) {
      setDrawingWire({ ...drawingWire, mouse: { x: e.clientX, y: e.clientY } });
    }
  };

  const handlePointerUp = (e) => {
    setDraggedNode(null);
    if (drawingWire) {
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const pinEl = elements.find(el => el.classList && el.classList.contains('pin-in'));
      
      if (pinEl) {
        const toNodeId = pinEl.getAttribute('data-nodeid');
        const toPinIndex = parseInt(pinEl.getAttribute('data-pinindex'), 10);
        
        if (toNodeId && drawingWire.fromNode !== toNodeId) {
          const newWires = wires.filter(w => !(w.to === toNodeId && w.toPin === toPinIndex));
          setWires([...newWires, {
            id: Date.now().toString(),
            from: drawingWire.fromNode,
            to: toNodeId,
            toPin: toPinIndex
          }]);
        }
      }
      setDrawingWire(null);
    }
  };

  const startWire = (e, nodeId) => {
    e.stopPropagation();
    setDrawingWire({ fromNode: nodeId, mouse: { x: e.clientX, y: e.clientY } });
  };

  // finishWire is no longer needed on the pins directly, handled by handlePointerUp

  const deleteWire = (id) => {
    setWires(wires.filter(w => w.id !== id));
  };

  // SVG Path generator for curvy wires
  const createBezierPath = (startX, startY, endX, endY) => {
    const cpX = (startX + endX) / 2;
    return `M ${startX} ${startY} C ${cpX} ${startY}, ${cpX} ${endY}, ${endX} ${endY}`;
  };

  return (
    <div 
      className="workspace" 
      onPointerMove={handlePointerMove} 
      onPointerUp={handlePointerUp}
      onContextMenu={e => e.preventDefault()}
    >
      <div className="header">
        <a href="/" style={{color: 'var(--text)', textDecoration: 'none'}}><ArrowLeft /></a>
        <h2>nond_ex Simulator</h2>
        <button className="btn" style={{marginLeft: 'auto'}} onClick={() => {setNodes([]); setWires([]);}}>Clear Board</button>
      </div>

      <div className="toolbox">
        <h3 style={{fontSize: '0.9rem', marginBottom: '5px', color: 'var(--wire)'}}>Components</h3>
        {Object.keys(GATE_TYPES).map(type => (
          <button key={type} className="btn" onClick={() => addNode(type)}>
            <Plus size={14} style={{display: 'inline', verticalAlign: 'middle', marginRight: '5px'}}/> {GATE_TYPES[type].name}
          </button>
        ))}
      </div>

      <svg className="wire-svg">
        {wires.map(wire => {
          const fromNode = nodes.find(n => n.id === wire.from);
          const toNode = nodes.find(n => n.id === wire.to);
          if (!fromNode || !toNode) return null;

          const startX = fromNode.x + 120; 
          const startY = fromNode.y + 40;

          const toPins = GATE_TYPES[toNode.type].inputs;
          const endX = toNode.x;
          let endY = toNode.y + 40;
          if (toPins === 2) {
            endY = toNode.y + (wire.toPin === 0 ? 24 : 56);
          }

          const isActive = fromNode.outValue;

          return (
            <g 
              key={wire.id} 
              onDoubleClick={(e) => { e.stopPropagation(); deleteWire(wire.id); }}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); deleteWire(wire.id); }}
              style={{cursor: 'pointer'}}
            >
              {/* Invisible thick path for easy clicking */}
              <path 
                d={createBezierPath(startX, startY, endX, endY)}
                style={{ stroke: 'transparent', strokeWidth: 20, fill: 'none', pointerEvents: 'stroke' }}
              />
              {/* Visible path */}
              <path 
                className={`wire ${isActive ? 'active' : ''}`}
                d={createBezierPath(startX, startY, endX, endY)}
                style={{ pointerEvents: 'none' }}
              />
            </g>
          );
        })}

        {drawingWire && (() => {
          const fromNode = nodes.find(n => n.id === drawingWire.fromNode);
          if (!fromNode) return null;
          const startX = fromNode.x + 120;
          const startY = fromNode.y + 40;
          return (
            <path 
              className="wire drawing active"
              d={createBezierPath(startX, startY, drawingWire.mouse.x, drawingWire.mouse.y)}
            />
          );
        })()}
      </svg>

      {nodes.map(node => {
        const typeInfo = GATE_TYPES[node.type];
        const isActive = node.outValue;

        return (
          <div 
            key={node.id}
            className={`logic-node ${isActive && typeInfo.inputs > 0 ? 'active-output' : ''}`}
            style={{ left: node.x, top: node.y, zIndex: draggedNode === node.id ? 10 : 1 }}
            onPointerDown={(e) => handlePointerDown(e, node.id)}
          >
            <div className="node-title">{typeInfo.name}</div>
            
            {node.type === 'INPUT' && (
              <div 
                style={{marginTop: '5px', padding: '5px', background: isActive ? 'var(--accent)' : '#1e293b', borderRadius: '4px', cursor: 'pointer', transition: '0.2s', fontWeight: 'bold'}}
                onClick={() => toggleInput(node.id)}
                onPointerDown={e => e.stopPropagation()}
              >
                {isActive ? '1' : '0'}
              </div>
            )}

            {node.type === 'OUTPUT' && (
              <div style={{marginTop: '5px', width: '30px', height: '30px', margin: '5px auto 0', borderRadius: '50%', background: isActive ? 'var(--accent)' : '#1e293b', boxShadow: isActive ? '0 0 20px var(--accent-glow)' : 'none', transition: '0.2s'}} />
            )}

            <button 
              onClick={() => removeNode(node.id)} 
              onPointerDown={e => e.stopPropagation()}
              style={{position: 'absolute', top: '-10px', right: '-10px', background: 'var(--bg-color)', border: '1px solid var(--node-border)', borderRadius: '50%', padding: '4px', color: 'var(--text)', cursor: 'pointer'}}
            >
              <Trash2 size={12}/>
            </button>

            {/* Input Pins */}
            {typeInfo.inputs === 1 && (
              <div 
                className={`pin pin-in ${node.inValues[0] ? 'active' : ''}`} 
                data-nodeid={node.id} data-pinindex="0"
              />
            )}
            {typeInfo.inputs === 2 && (
              <>
                <div 
                  className={`pin pin-in pin-in-1 ${node.inValues[0] ? 'active' : ''}`} 
                  data-nodeid={node.id} data-pinindex="0"
                />
                <div 
                  className={`pin pin-in pin-in-2 ${node.inValues[1] ? 'active' : ''}`} 
                  data-nodeid={node.id} data-pinindex="1"
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
