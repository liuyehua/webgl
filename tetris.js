import * as THREE from "three";

var t = THREE;
var renderer, camera, width, height, scene, canvas;

// 设置一个方格长宽为20
var cubeWidth = 20;
// 横向10格，纵向20格, 间隙为4
var lineWidthSeg = 10,lineHeightSeg = 20,seg = 4;
// 计算外框线长与宽
var lineWidth = cubeWidth * lineWidthSeg + seg * (lineWidthSeg + 1);
var lineHeight = cubeWidth * lineHeightSeg + seg * (lineHeightSeg + 1);

// 存储方块的矩阵
var matrix = [],nextMatrix = [];
// 定时器
var timer;

var raycaster = new THREE.Raycaster();
var mouse = new THREE.Vector2();

class Cube {
    constructor(type, position) {
        // 方块类型
        this.type = type;
        // 记录方块当前的位置信息
        this.position = position;
    }
}

export default class Tetris {
    constructor(dom) {
        if (dom != null) {
            canvas = document.getElementById(dom);
            width = canvas.offsetWidth;
            height = canvas.offsetHeight;
        } else {
            width = window.innerWidth;
            height = window.innerHeight;
        }
        this.haveStart = false;
        this.currentCube = null;
        this.nextCube = null;
        this.score = 0;
        this.speed = 500;
        this.scoreLabel;
        this.canUpdate=false;
        this.init();
        this.initKeyListener();
    }

    initKeyListener() {
        document.addEventListener('keydown', ({keyCode}) => {
            switch (keyCode) {
                case 37:this.moveLeftAndRight(0);break;// 左移
                case 39:this.moveLeftAndRight(1);break;// 右移
                case 38:this.rotateMatrixView();break; // 方向上 旋转
                case 40:this.moveDown();break; // 方向下
                case 32:this.pause();break; //空格键暂停
            }
        });
    }

    pause(){
        if(timer!=null){
            clearInterval(timer);
            this.haveStart = false;
            timer = null;
        }else{
            this.start();
        }
    }

    //深度拷贝
    copyArr(m) {
        return JSON.parse(JSON.stringify(m));
    }

    //给一点p绕着某一点pBase进行旋转操作
    rotate(p,ptBase) {
        var degree = Math.PI / 2;

        let x = Math.floor((p[0] - ptBase[0]) * Math.cos(degree) + (p[1] - ptBase[1]) * math.sin(degree) + ptBase[0]);
        let y = Math.floor(-(p[0] - ptBase[0]) * Math.sin(degree) + (p[1] - ptBase[1]) * math.cos(degree) + ptBase[1]);

        return [x,y];
    }

    rotateMatrixView() {
        var pos = this.currentCube.position;
        var copy = this.copyArr(this.currentCube.position);
        var type = this.currentCube.type;

        // 某点(ab)绕点（mn）逆时针90度 得点（m+n-b,n-m+a)  
        var cx = Math.round((copy[0][0] + copy[1][0] + copy[2][0] + copy[3][0]) / 4);
        var cy = Math.round((copy[0][1] + copy[1][1] + copy[2][1] + copy[3][1]) / 4);
        //旋转的主要算法. 可以这样分解来理解。  
        //先假设围绕源点旋转。然后再加上中心点的坐标。  
        for (var i = 0; i < 4; i++) {
            copy[i][0] = cx + cy - pos[i][1];
            copy[i][1] = cy - cx + pos[i][0];
        }

        //对横向长条以及两个S型进行精度补偿
        if(type==1||type==5||type==7){
            if(copy[0][0]==copy[1][0]){
                for(let i=0;i<4;i++){
                    copy[i][0] -=1;
                }
            }
        }

        var canRotate = true;
        var minus = this.minusMatrix(copy, pos);
        for (let i = 0; i < minus.length; i++) {
            if (minus[i][0] < 0 || minus[i][1] < 0 || minus[i][0] > 19 || minus[i][1] > 9) {
                canRotate = false;
                break;
            }
            if (matrix[minus[i][0]][minus[i][1]].cube.visible == true) {
                canRotate = false;
                break;
            }
        }
        if (canRotate) {
            this.canUpdate = true;
            this.updateMartixView(copy);
            this.currentCube.position = copy;
        }
    }

    //更新视图矩阵
    updateMartixView(newpos) {
        if(this.canUpdate){
            var pos;
            //将之前的隐藏
            for (let i = 0; i < this.currentCube.position.length; i++) {
                pos = this.currentCube.position[i];
                matrix[pos[0]][pos[1]].cube.visible = false;
            }
            //显示新的
            for (let i = 0; i < newpos.length; i++) {
                matrix[newpos[i][0]][newpos[i][1]].cube.visible = true;
            }
        }
    }

    //计算两个二维数组差集,用于判断变更后的部分能否移动
    minusMatrix(m1, m2) {
        var arr = [];
        var flag = true;
        for (let i = 0; i < m1.length; i++) {
            flag = true;
            for (let j = 0; j < m2.length; j++) {
                if (m1[i][0] == m2[j][0] && m1[i][1] == m2[j][1]) {
                    flag = false;
                    break;
                }
            }
            if (flag) {
                arr.push([m1[i][0], m1[i][1]]);
            }
        }
        return arr;
    }

    start() {
        if (!this.haveStart) {
            timer = setInterval(() => {
                this.moveDown();
            }, this.speed);
            this.haveStart = true;
        }
    }

    restart() {
        if (this.haveStart) {
            this.score = 0;
            clearInterval(timer);
            matrix.forEach(m => {
                m.forEach(n => {
                    n.cube.visible = false;
                });
            })
            this.generateCube();
            this.haveStart = false;
        }
    }

    moveDown() {
        let pos = this.currentCube.position;
        var x, y;
        var newpos = [];
        var canMove = true;
        for (let i = 0; i < pos.length; i++) {
            x = pos[i][0], y = pos[i][1];
            if (x + 1 <= 19) {
                newpos.push([x + 1, y]);
            } else {
                break;
            }
        }
        if (newpos.length == pos.length) {
            //计算出变更前后两个矩阵的差集
            let minus = this.minusMatrix(newpos, pos);
            //判断变更的部分能否移动
            for (let i = 0; i < minus.length; i++) {
                if (matrix[minus[i][0]][minus[i][1]].cube.visible != false) {
                    canMove = false;
                    break;
                }
            }
            if (canMove) {
                this.canUpdate = true;
                this.updateMartixView(newpos);
                this.currentCube.position = newpos;
            } else {
                // 如果发生碰撞了,先消除
                this.clearCubes();
                this.generateCube();
            }
        } else { // 如果到最底层了，重新生成图案
            this.clearCubes();
            this.generateCube();
        }
    }

    // 清除某一行全部点亮的
    clearCubes() {
        this.canUpdate = false;
        var clear = false,lineNumber = [];
        for (let i = 0; i <= 19; i++) {
            for (let j = 0; j <= 9; j++) {
                // 判断某一行是否全部点亮
                if (matrix[i][j].cube.visible == true) {
                    clear = true;
                } else {
                    clear = false;
                    break;
                }
            }
            if (clear) {
                lineNumber.push(i);
            }
        }
        if(lineNumber.length>0){
            //加分
            this.score += lineNumber.length*10;
            this.scoreLabel.material.map = new THREE.CanvasTexture( this.generateSprite('score:'+this.score,'red') );

            //消除完整
            for (let i = lineNumber.length-1; i >=0 ; i--) {
                for (let j = 0; j <= 9; j++) {
                    matrix[lineNumber[i]][j].cube.visible = false;
                }
            }

            //将上面的移动下来
            for(let i=0;i<lineNumber.length;i++){
                for(let j=lineNumber[i];j>=1;j--){
                    for(let k=0;k<=9;k++){
                        if(matrix[j-1][k].cube.visible == true){
                            matrix[j-1][k].cube.visible = false;
                            matrix[j][k].cube.visible = true;
                        }
                    }
                }
            }
        }
    }

    moveLeftAndRight(type) {
        let pos = this.currentCube.position;
        var x, y;
        var newpos = [];
        var canMove = true;
        var step = type == 0 ? -1 : 1;
        for (let i = 0; i < pos.length; i++) {
            x = pos[i][0], y = pos[i][1];
            if (y + step >= 0 && y + step <= 9) {
                newpos.push([x, y + step]);
            } else {
                break;
            }
        }
        if (newpos.length == pos.length) {
            //计算出变更前后两个矩阵的差集
            let minus = this.minusMatrix(newpos, pos);
            //判断变更的部分能否移动
            for (let i = 0; i < minus.length; i++) {
                if (matrix[minus[i][0]][minus[i][1]].cube.visible != false) {
                    canMove = false;
                    break;
                }
            }
            if (canMove) {
                this.canUpdate = true;
                this.updateMartixView(newpos);
                this.currentCube.position = newpos;
            }
        }
    }

    // 初始化所有游戏设置
    init() {
        matrix = [];
        this.currentCube = null;
        this.initScene();
        this.initCamera();
        this.initRenderer();
        this.initLight();
        this.initGraphic();
        this.animate();

        window.addEventListener('resize', () => {
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            this.render();
            renderer.setSize(width, height);
        });

        window.addEventListener('mousedown',this.onMouseClick.bind(this));
    }

    onMouseClick( event ) {
        //通过鼠标点击的位置计算出raycaster所需要的点的位置，以屏幕中心为原点，值的范围为-1到1.
        mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
        mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

        // 通过鼠标点的位置和当前相机的矩阵计算出raycaster
        raycaster.setFromCamera( mouse, camera );

        // 获取raycaster直线和所有模型相交的数组集合
        var intersects = raycaster.intersectObjects( scene.children );

        if(intersects.length==1){
            if(intersects[0].object.name=='start'){
                this.start();
            }
        }else if(intersects.length==2){
            if(intersects[1].object.name=='restart'){
                this.restart();
            }
        }
    }

    animate() {
        this.render();
        requestAnimationFrame(this.animate.bind(this));
    }

    // 初始化游戏图形界面
    initGraphic() {
        //初始化轮廓线
        this.initRectLine();
        //初始化方块
        this.initCubes();
        //随机生成方块
        this.generateCube();
    }

    //判断是否输了
    isLose() {
        let num = 0;
        for (let i = 3; i <= 6; i++) {
            if (matrix[0][i].cube.visible == true) {
                num++;
            }
        }
        return num >= 3;
    }

    //生成下一个方块
    generateCube() {
        // 判断是否输了
        if (this.isLose()) {
            this.score = 0;
            this.scoreLabel.material.map = new THREE.CanvasTexture( this.generateSprite('score:'+this.score,'red') );
            return this.restart();
        }
        var types = [
            new Cube(1, [[0, 3],[0, 4],[0, 5],[0, 6]]),
            new Cube(2, [[0, 3],[1, 3],[1, 4],[1, 5]]),
            new Cube(3, [[0, 5],[1, 3],[1, 4],[1, 5]]),
            new Cube(4, [[0, 4],[0, 5],[1, 4],[1, 5]]),
            new Cube(5, [[0, 5],[0, 6],[1, 4],[1, 5]]),
            new Cube(6, [[0, 5],[1, 4],[1, 5],[1, 6]]),
            new Cube(7, [[0, 3],[0, 4],[1, 4],[1, 5]])
        ];

        // 随机生成七种形状之一
        if(this.nextCube==null){
            this.currentCube = types[Math.floor(Math.random() * 7)];
        }else{
            this.currentCube = this.nextCube;
        }
        this.nextCube = types[Math.floor(Math.random() * 7)];

        var pos = this.currentCube.position;
        var nextPos = this.nextCube.position;
        for(let i=0;i<pos.length;i++){
            matrix[pos[i][0]][pos[i][1]].cube.visible = true;
        }

        //隐藏之前的下一个方格
        for(let i=0;i<nextMatrix.length;i++){
            for(let j=0;j<nextMatrix[i].length;j++){
                nextMatrix[i][j].visible = false;
            }
        }

        //显示下一个cube
        for(let i=0;i<nextPos.length;i++){
            nextMatrix[nextPos[i][0]][nextPos[i][1]-3].visible = true;
        }
    }

    initCubes() {
        matrix = [];
        var martixObject = new t.Object3D();
        var cube = new t.BoxGeometry(cubeWidth, cubeWidth, 20);
        var map = new t.TextureLoader().load(getImage());
        map.wrapS = map.mapT = t.RepeatWrapping;
        var material = new t.MeshLambertMaterial({map,side:t.DoubleSide});
        var mesh = new t.Mesh(cube, material);
        var m = 0,n = 0;
        // 初始化所有方块设置为隐藏
        for (let j = lineHeight / 2 - cubeWidth / 2 - seg; j > -lineHeight / 2; j -= (cubeWidth + seg), m++, n = 0) {
            matrix[m] = [];
            for (let i = -lineWidth + cubeWidth / 2 + seg; i < 0; i += (cubeWidth + seg), n++) {
                mesh = mesh.clone(true);
                mesh.receiveShadow = true;
                mesh.position.set(i, j, 0);
                mesh.visible = false;
                matrix[m][n] = {cube: mesh};
                martixObject.add(mesh);
            }
        }
        scene.add(martixObject);

        var nextCubes = new t.Object3D();
        // NEXT
        for(let i=0;i<4;i++){
            nextMatrix[i] = [];
            for(let j=0;j<4;j++){
                mesh = mesh.clone(true);
                mesh.position.set((cubeWidth+seg)*j,(cubeWidth+seg)*i,0);
                nextMatrix[i][j] = mesh;
                nextCubes.add(mesh);
            }
        }
        nextCubes.translateY(140).translateX(58);
        nextCubes.rotateZ(-Math.PI);
        nextCubes.rotateY(-Math.PI);
        scene.add(nextCubes);
    }

    //初始化轮廓线
    initRectLine() {
        var rect = new t.Group();

        var lineMaterial = new t.MeshBasicMaterial({color: 0xffffff,});

        var TopAnBottomGeometry = new t.Geometry();
        var LeftAndRightGemotry = new t.Geometry();

        TopAnBottomGeometry.vertices.push(
            new t.Vector3(-lineWidth, lineHeight / 2, 0),
            new t.Vector3(0, lineHeight / 2, 0)
        )

        var top = new t.Line(TopAnBottomGeometry, lineMaterial);
        var bottom = top.clone(true);
        bottom.position.y -= lineHeight;

        LeftAndRightGemotry.vertices.push(
            new t.Vector3(-lineWidth, lineHeight / 2, 0),
            new t.Vector3(-lineWidth, -lineHeight / 2, 0),
        )
        var left = new t.Line(LeftAndRightGemotry, lineMaterial);
        var right = left.clone(true);
        right.position.x += lineWidth;

        rect.add(top, bottom, left, right);
        scene.add(rect);

        let menu = rect.clone(true);
        menu.scale.setX(0.7);
        menu.translateX(lineWidth*0.7+10);
        scene.add(menu);

        var material = new THREE.SpriteMaterial( {
            map: new THREE.CanvasTexture( this.generateSprite('score:'+this.score,'red') ),
            color:0xffffff
        });
        this.scoreLabel = new THREE.Sprite( material );
        this.scoreLabel.scale.set(120,120,120);
        this.scoreLabel.position.set(90,lineHeight/3,0);
        scene.add(this.scoreLabel);

        var start = this.scoreLabel.clone(true);
        start.material = new t.SpriteMaterial({
            map:new THREE.CanvasTexture( this.generateSprite('start','white') )
        });
        start.name = 'start';
        start.translateY(-350);
        scene.add(start);
        var restart = start.clone(true);
        restart.material = new t.SpriteMaterial({
            map:new THREE.CanvasTexture( this.generateSprite('restart','white') )
        });
        restart.translateX(80);
        restart.name = 'restart';
        scene.add(restart);

        var next = restart.clone(true);
        next.material = new t.SpriteMaterial({
            map:new THREE.CanvasTexture( this.generateSprite('next','#00FFFF') )
        });
        next.translateY(320).translateX(-80);
        scene.add(next);
    }

    //这个才是创建单个字符片段的函数
    generateSprite(text,style) {
        var canvas = document.createElement( 'canvas' );
        canvas.width = 200;
        canvas.height = 200;

        var context = canvas.getContext( '2d' );
            context.strokeStyle = '#ffffff';
            context.font='30px Microsoft YaHei';
            context.fillStyle = style;
            context.fillText(text,0,30);
            context.fill();
            context.stroke();

        return canvas;
    }

    initScene() {
        scene = new t.Scene();
    }

    initRenderer() {
        renderer = new t.WebGLRenderer({antialias: true,alpha: true});
        renderer.setSize(width, height);
        renderer.setClearColor(0x000000);
        if (canvas != null) {
            canvas.appendChild(renderer.domElement);
        } else {
            document.body.appendChild(renderer.domElement);
        }
    }

    initCamera() {
        camera = new t.PerspectiveCamera(60, width / height, 1, 10000);
        camera.position.set(0, 0, 450);
        camera.lookAt(0, 0, 0);
    }

    initLight() {
        var light = new THREE.PointLight(0xffffff, 1, 10000);
        light.position.set(100, 100, 1000);
        light.castShadow = true;
        scene.add(light);

        var light2 = new THREE.DirectionalLight(0xffffff);
        light2.position.set(0, 1000, 0);
        light2.castShadow = true;
        scene.add(light2);
    }

    render() {
        renderer.render(scene, camera);
    }
}

// 贴图的base64格式
function getImage(){
    return `
    data:image/jpeg;base64,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
`;
}