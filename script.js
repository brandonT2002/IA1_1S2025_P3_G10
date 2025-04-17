const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x202020);

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7.5);
        scene.add(directionalLight);

        const loader = new THREE.FBXLoader();
        let mixer;
        const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
        const startMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        const endMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        const pathMaterial = new THREE.MeshStandardMaterial({ color: 0x0000ff, opacity: 0.6, transparent: true });

        const cubeSize = 1;
        let robot;
        let path = [];
        let step = 0;
        let searchStarted = false;
        let mazeData;

        function bfs(maze, start, end) {
            const { ancho, alto, paredes } = maze;
            const queue = [[start[0], start[1]]];
            const visited = Array.from({ length: ancho }, () => Array(alto).fill(false));
            const prev = Array.from({ length: ancho }, () => Array(alto).fill(null));
            const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];

            visited[start[0]][start[1]] = true;

            while (queue.length > 0) {
                const [x, y] = queue.shift();
                if (x === end[0] && y === end[1]) break;

                directions.forEach(([dx, dy]) => {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx >= 0 && ny >= 0 && nx < ancho && ny < alto && !visited[nx][ny] && !paredes.some(([px, py]) => px === nx && py === ny)) {
                        visited[nx][ny] = true;
                        prev[nx][ny] = [x, y];
                        queue.push([nx, ny]);
                    }
                });
            }

            let current = end;
            while (current && (current[0] !== start[0] || current[1] !== start[1])) {
                path.unshift(current);
                current = prev[current[0]][current[1]];
            }
            path.unshift(start);
        }

        function dijkstra(maze, start, end) {
            const { ancho, alto, paredes } = maze;
            const grid = Array.from({ length: ancho }, () => Array(alto).fill(Infinity));
            const prev = Array.from({ length: ancho }, () => Array(alto).fill(null));
            const openList = [];
            const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];

            grid[start[0]][start[1]] = 0;
            openList.push([start[0], start[1]]);

            while (openList.length > 0) {
                const [x, y] = openList.shift();
                if (x === end[0] && y === end[1]) break;

                directions.forEach(([dx, dy]) => {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx >= 0 && ny >= 0 && nx < ancho && ny < alto && !paredes.some(([px, py]) => px === nx && py === ny)) {
                        const newDist = grid[x][y] + 1;
                        if (newDist < grid[nx][ny]) {
                            grid[nx][ny] = newDist;
                            prev[nx][ny] = [x, y];
                            openList.push([nx, ny]);
                        }
                    }
                });
            }

            let current = end;
            while (current && (current[0] !== start[0] || current[1] !== start[1])) {
                path.unshift(current);
                current = prev[current[0]][current[1]];
            }
            path.unshift(start);
        }

        function aStar(maze, start, end) {
            const { ancho, alto, paredes } = maze;
            const grid = Array.from({ length: ancho }, () => Array(alto).fill(Infinity));
            const prev = Array.from({ length: ancho }, () => Array(alto).fill(null));
            const openList = [];
            const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];

            const heuristic = (x, y) => Math.abs(x - end[0]) + Math.abs(y - end[1]);

            grid[start[0]][start[1]] = 0;
            openList.push([start[0], start[1]]);

            while (openList.length > 0) {
                const [x, y] = openList.shift();
                if (x === end[0] && y === end[1]) break;

                directions.forEach(([dx, dy]) => {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx >= 0 && ny >= 0 && nx < ancho && ny < alto && !paredes.some(([px, py]) => px === nx && py === ny)) {
                        const newDist = grid[x][y] + 1;
                        if (newDist < grid[nx][ny]) {
                            grid[nx][ny] = newDist;
                            prev[nx][ny] = [x, y];
                            openList.push([nx, ny]);
                        }
                    }
                });
            }

            let current = end;
            while (current && (current[0] !== start[0] || current[1] !== start[1])) {
                path.unshift(current);
                current = prev[current[0]][current[1]];
            }
            path.unshift(start);
        }

        fetch('maze.json')
            .then(res => res.json())
            .then(data => {
                mazeData = data;
                const { ancho, alto, inicio, fin, paredes } = data;

                for (let x = 0; x < ancho; x++) {
                    for (let y = 0; y < alto; y++) {
                        const floor = new THREE.Mesh(
                            new THREE.BoxGeometry(cubeSize, 0.1, cubeSize),
                            floorMaterial
                        );
                        floor.position.set(y, -0.05, x);
                        scene.add(floor);
                    }
                }

                paredes.forEach(([x, y]) => {
                    const wall = new THREE.Mesh(
                        new THREE.BoxGeometry(cubeSize, 1, cubeSize),
                        wallMaterial
                    );
                    wall.position.set(y, 0.5, x);
                    scene.add(wall);
                });

                const start = new THREE.Mesh(
                    new THREE.BoxGeometry(cubeSize, 0.1, cubeSize),
                    startMaterial
                );
                start.position.set(inicio[1], 0.01, inicio[0]);
                scene.add(start);

                const end = new THREE.Mesh(
                    new THREE.BoxGeometry(cubeSize, 0.1, cubeSize),
                    endMaterial
                );
                end.position.set(fin[1], 0.01, fin[0]);
                scene.add(end);

                loader.load('robot2.fbx', function (object) {
                    object.scale.set(0.01, 0.01, 0.01);
                    object.position.set(inicio[1], 0, inicio[0]);
                    robot = object;
                    scene.add(object);
                });


                // Posición de la cámra
                camera.position.set(alto / 2, alto + 2, ancho / 2);
                // Rotación de cámara
                camera.lookAt(alto / 2, 0, ancho / 2);

                const clock = new THREE.Clock();
                let previousDirection = null;

                function animate() {
                    requestAnimationFrame(animate);
                    const delta = clock.getDelta();
                    if (mixer) mixer.update(delta);

                    if (robot && searchStarted && path.length > 0) {
                        if (step < path.length) {
                            const [targetX, targetY] = path[step];
                            const targetPosition = new THREE.Vector3(targetY, 0, targetX);
                            const robotPosition = robot.position;

                            let direction = null;
                            if (targetY > robotPosition.x) direction = 'right';
                            if (targetY < robotPosition.x) direction = 'left';
                            if (targetX > robotPosition.z) direction = 'forward';
                            if (targetX < robotPosition.z) direction = 'backward';

                            if (direction !== previousDirection) {
                                if (direction === 'right') robot.rotation.y = Math.PI / 2;
                                else if (direction === 'left') robot.rotation.y = -Math.PI / 2;
                                else if (direction === 'forward') robot.rotation.y = 0;
                                else if (direction === 'backward') robot.rotation.y = Math.PI;
                            }

                            robotPosition.lerp(targetPosition, 0.05);

                            if (robotPosition.distanceTo(targetPosition) < 0.1) {
                                const pathTile = new THREE.Mesh(
                                    new THREE.BoxGeometry(cubeSize * 0.8, 0.05, cubeSize * 0.8),
                                    pathMaterial
                                );
                                pathTile.position.set(targetY, 0.02, targetX);
                                scene.add(pathTile);

                                step++;
                                previousDirection = direction;
                            }
                        }

                        if (step >= path.length) {
                            const walkClip = robot.animations.find(anim => anim.name === "mixamo.com");
                            walkClip.start();
                            if (walkClip && mixer) {
                                mixer.stopAllAction();
                                console.log("Animación detenida: Robot ha llegado al final.");
                            }
                        }
                    }

                    renderer.render(scene, camera);
                }

                animate();
            });

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        document.getElementById('startButton').addEventListener('click', () => {
            if (!searchStarted && mazeData) {
                searchStarted = true;
                const { inicio, fin } = mazeData;
                const algorithm = document.getElementById('algorithmSelect').value;

                if (algorithm === 'dijkstra') {
                    dijkstra(mazeData, inicio, fin);
                } else if (algorithm === 'aStar') {
                    aStar(mazeData, inicio, fin);
                } else if (algorithm === 'bfs') {
                    bfs(mazeData, inicio, fin);
                }
            }
        });