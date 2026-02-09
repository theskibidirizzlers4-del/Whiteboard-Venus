import { useRef, useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

// 🔧 Replace with your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAZHwEhv0MEmYamoKrTOJ7EivHU_DYmwPo",
  authDomain: "whiteboard-venus.firebaseapp.com",
  projectId: "whiteboard-venus",
  storageBucket: "whiteboard-venus.firebasestorage.app",
  messagingSenderId: "181143066286",
  appId: "1:181143066286:web:8d343279daa1f982da7f3f",
  measurementId: "G-LX5VBM0DPV"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function WhiteboardVenus() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [drawing, setDrawing] = useState(false);
  const [tool, setTool] = useState("draw");
  const [currentPath, setCurrentPath] = useState([]);
  const [isPanning, setIsPanning] = useState(false);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [strokes, setStrokes] = useState([]);

  // setup canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width = containerRef.current.clientWidth;
      canvas.height = containerRef.current.clientHeight;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 3;
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // listen for multiplayer strokes
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "strokes"), (snap) => {
      const arr = [];
      snap.forEach((doc) => arr.push(doc.data()));
      setStrokes(arr);
    });
    return () => unsub();
  }, []);

  // redraw everything clean each frame
  const redraw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawStroke = (points) => {
      if (!points || points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(points[0].x + viewOffset.x, points[0].y + viewOffset.y);
      for (let i = 1; i < points.length; i++) {
        const p = points[i];
        ctx.lineTo(p.x + viewOffset.x, p.y + viewOffset.y);
      }
      ctx.stroke();
    };

    strokes.forEach((s) => drawStroke(s.points));
    drawStroke(currentPath);
  };

  useEffect(redraw, [strokes, currentPath, viewOffset]);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left - viewOffset.x,
      y: e.clientY - rect.top - viewOffset.y,
    };
  };

  const startDraw = (e) => {
    if (tool === "pan") {
      setIsPanning(true);
      return;
    }

    if (e.button !== 0) return; // only left click

    const p = getPos(e);
    setCurrentPath([p]);
    setDrawing(true);
  };

  const draw = (e) => {
    // stop lines instantly if mouse not pressed
    if (tool === "draw" && e.buttons !== 1) return;

    if (tool === "pan" && isPanning && e.buttons === 1) {
      setViewOffset((o) => ({
        x: o.x + e.movementX,
        y: o.y + e.movementY,
      }));
      return;
    }

    if (!drawing || tool !== "draw") return;

    const p = getPos(e);
    setCurrentPath((path) => [...path, p]);
  };

  const endDraw = async () => {
    if (drawing && currentPath.length > 1) {
      await addDoc(collection(db, "strokes"), {
        points: currentPath,
        created: serverTimestamp(),
      });
    }

    setDrawing(false);
    setIsPanning(false);
    setCurrentPath([]);
  };

  return (
    <div
      ref={containerRef}
      className="w-screen h-screen flex flex-col bg-neutral-100"
    >
      <div className="p-3 shadow-md bg-white flex gap-2 items-center">
        <h1 className="text-xl font-bold">
          Whiteboard Venus • Infinite Board by Venus
        </h1>

        <button
          className="px-3 py-1 rounded-2xl border"
          onClick={() => setTool("draw")}
        >
          Draw
        </button>

        <button
          className="px-3 py-1 rounded-2xl border"
          onClick={() => setTool("pan")}
        >
          Pan
        </button>

        <span className="text-sm opacity-70 ml-4">
          Line stops on mouse release ✔
        </span>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 cursor-crosshair bg-white"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
        />
      </div>
    </div>
  );
}
