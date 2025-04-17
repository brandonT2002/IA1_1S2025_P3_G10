// Construye el grafo desde el laberinto
function construirGrafo(ancho, alto, paredes) {
    const grafo = {};
    const esPared = (x, y) => paredes.some(p => p[0] === x && p[1] === y);
  
    for (let x = 0; x < ancho; x++) {
      for (let y = 0; y < alto; y++) {
        if (esPared(x, y)) continue;
        const vecinos = [];
        [[x+1,y],[x-1,y],[x,y+1],[x,y-1]].forEach(([nx, ny]) => {
          if (nx >= 0 && nx < ancho && ny >= 0 && ny < alto && !esPared(nx, ny)) {
            vecinos.push(`${nx},${ny}`);
          }
        });
        grafo[`${x},${y}`] = vecinos;
      }
    }
    return grafo;
  }
  
  // Dijkstra para encontrar el camino más corto
  function dijkstra(grafo, inicio, fin) {
    const distancias = {};
    const previos = {};
    const nodos = new Set(Object.keys(grafo));
  
    nodos.forEach(n => { distancias[n] = Infinity; previos[n] = null; });
    distancias[inicio] = 0;
  
    while (nodos.size > 0) {
      let minNodo = [...nodos].reduce((a, b) => distancias[a] < distancias[b] ? a : b);
      nodos.delete(minNodo);
  
      grafo[minNodo].forEach(vecino => {
        const alt = distancias[minNodo] + 1;
        if (alt < distancias[vecino]) {
          distancias[vecino] = alt;
          previos[vecino] = minNodo;
        }
      });
    }
  
    const camino = [];
    let actual = fin;
    while (actual) {
      camino.unshift(actual);
      actual = previos[actual];
    }
    return camino;
  }
  
  // Animación del robot
  function animarRobot(robot, camino, duracionTotal) {
    let i = 0;
    const tiempoPorPaso = duracionTotal / (camino.length - 1);
    const reloj = new THREE.Clock();
  
    function mover() {
      if (i >= camino.length - 1) return;
  
      const [x1, y1] = camino[i].split(',').map(Number);
      const [x2, y2] = camino[i + 1].split(',').map(Number);
      const inicio = new THREE.Vector3(x1, 0, y1);
      const fin = new THREE.Vector3(x2, 0, y2);
      let t = 0;
  
      function animarPaso() {
        t += reloj.getDelta() / tiempoPorPaso;
        if (t < 1) {
          robot.position.lerpVectors(inicio, fin, t);
          requestAnimationFrame(animarPaso);
        } else {
          i++;
          mover();
        }
      }
      animarPaso();
    }
    mover();
  }
  
  // Escena principal
  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
  
  const luz = new THREE.DirectionalLight(0xffffff, 1);
  luz.position.set(10, 20, 10);
  escena.add(luz);
  
  // Carga laberinto
  fetch('maze.json')
    .then(res => res.json())
    .then(data => {
      const { ancho, alto, inicio, fin, paredes } = data;
      const grafo = construirGrafo(ancho, alto, paredes);
      const camino = dijkstra(grafo, `${inicio[0]},${inicio[1]}`, `${fin[0]},${fin[1]}`);
  
      // Dibujar celdas
      const celda = new THREE.BoxGeometry(1, 0.1, 1);
      const pisoMat = new THREE.MeshStandardMaterial({ color: 0xdddddd });
      const paredMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  
      for (let x = 0; x < ancho; x++) {
        for (let y = 0; y < alto; y++) {
          const pos = new THREE.Mesh(celda, pisoMat);
          pos.position.set(x, -0.05, y);
          escena.add(pos);
  
          if (paredes.some(p => p[0] === x && p[1] === y)) {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), paredMat);
            wall.position.set(x, 0.5, y);
            escena.add(wall);
          }
        }
      }
  
      camara.position.set(ancho / 2, 8, alto / 2);
      camara.lookAt(ancho / 2, 0, alto / 2);
  
      // Cargar robot
      const loader = new THREE.FBXLoader();
      loader.load('robot.fbx', function (obj) {
        obj.scale.set(0.01, 0.01, 0.01);
        escena.add(obj);
        obj.position.set(inicio[0], 0, inicio[1]);
  
        animarRobot(obj, camino, 5); // 5 segundos total
      });
  
      animate();
    });
  
  function animate() {
    requestAnimationFrame(animate);
    renderer.render(escena, camara);
  }
  