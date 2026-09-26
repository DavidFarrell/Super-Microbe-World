import ebug.*;

var player = 0;

function random_square_test(balls) {
	board1._visible = false;
	board2._visible = false;
	
	var playerMC:MovieClip = this.attachMovie("b6" , "avatar", this.getNextHighestDepth());

	ps.createBoxParticle(new Vector3(350, 50, 0), playerMC, true, new Vector3(0, 0, 0));
	for (var i = 0; i < balls; i++) {
		var xForce = 0;//randRange(-1000, 1000);
		var yForce = 0;//randRange(-1000,1000);
		var dyn = false;
		if (i == 0) {
			dyn = true;
		}
		var currentMC:MovieClip = this.attachMovie("b" + randRange(1, 5) , "ball"+i, this.getNextHighestDepth());
		var x:Number = randRange(ps.worldMin.x, ps.worldMax.x);
		var y:Number = randRange(ps.worldMin.y, ps.worldMax.y);
		ps.createBoxParticle(new Vector3(x, y, 0), currentMC, dyn, new Vector3(xForce, yForce, 0));
		
		this["ball"+i].index = i;
		this["ball"+i].onReleaseOutside = function() {
			_root["ball"+this.index]._x = _xmouse;
			_root["ball"+this.index]._y = _ymouse;
			_root.ps.staticEntities[this.index][ParticleSystem.ENTITY].setPosition(new Vector3(this._x, this._y, 0));
		}

	}	
	mapControls();
}

function sticks_and_stones(numSquares) {
	board1._visible = false;
	board2._visible = false;
	
	for (var i = 0; i < numSquares; i++) {
		for (var j = (i * 4); j < (i * 4) + 4 ;j++) {
			var xForce = 0;//randRange(-1000, 1000);
			var yForce = 0;//randRange(-1000,1000);
			var dyn = true;
			if (i == 0) {
				dyn = true;
			}
			var currentMC:MovieClip = this.attachMovie("b" + randRange(1, 5) , "box"+j, this.getNextHighestDepth());
			var x:Number = randRange(ps.worldMin.x, ps.worldMax.x);
			var y:Number = randRange(ps.worldMin.y, ps.worldMax.y);
			ps.createBoxParticle(new Vector3(x, y, 0), currentMC, dyn, new Vector3(xForce, yForce, 0));
		}
		var j = (i * 4);
		ps.createStick(j, ((j+1)%4) + i*4, boxdist );
		j++
		ps.createStick(j, ((j+1)%4) + i*4, boxdist );
		j++
		ps.createStick(j, ((j+1)%4) + i*4, boxdist );
		j++
		ps.createStick(j, ((j+1)%4) + i*4, boxdist );
		j = (i * 4);
		ps.createStick(j, j+2, Math.sqrt(boxdist*boxdist + boxdist*boxdist) );
		ps.createStick(j+1, j+3, Math.sqrt(boxdist*boxdist + boxdist*boxdist) );
	}
	
	var playerMC:MovieClip = this.attachMovie("b6" , "avatar", this.getNextHighestDepth());
	ps.createBoxParticle(new Vector3(350, 50, 0), playerMC, true, new Vector3(0, 0, 0));

	mapControls();
}

function jump_test(balls) {
	board1._visible = false;
	board2._visible = false;
	
	var playerMC:MovieClip = this.attachMovie("b6" , "avatar", this.getNextHighestDepth());

	ps.createBoxParticle(new Vector3(350, 50, 0), playerMC, true, new Vector3(0, 0, 0));

	
		var xForce = 0;//randRange(-1000, 1000);
		var yForce = 0;//randRange(-1000,1000);
		var dyn = true;

		
		var s1:MovieClip = this.attachMovie("b1", "s1", this.getNextHighestDepth());
		var s2:MovieClip = this.attachMovie("b1", "s2", this.getNextHighestDepth());
		var d1:MovieClip = this.attachMovie("b3", "d1", this.getNextHighestDepth());
		var d2:MovieClip = this.attachMovie("b3", "d2", this.getNextHighestDepth());
		
		ps.createBoxParticle(new Vector3(50, 399, 0), s1, false, new Vector3(), true);
		ps.createBoxParticle(new Vector3(100, 399, 0), s2, false, new Vector3(), true);
		ps.createBoxParticle(new Vector3(150, 399, 0), d1, true, new Vector3(), false);
		ps.createBoxParticle(new Vector3(200, 399, 0), d2, true, new Vector3(), false);
		
		
	mapControls();
}

function mapControls() {
	player = findAvatar();
	ps.dynamicEntities[player][ParticleSystem.CLIP].dir = "right";	
	var keyListener:Object = new Object();
	keyListener.onKeyDown = function() {
		if (Key.getCode() == Key.DOWN) {
			ps.dynamicEntities[player][ParticleSystem.ENTITY].force = ps.dynamicEntities[0][ParticleSystem.ENTITY].force.add(new Vector3(0, accel, 0));
		}
		if (Key.getCode() == Key.UP) {
			ps.dynamicEntities[player][ParticleSystem.ENTITY].force = ps.dynamicEntities[0][ParticleSystem.ENTITY].force.add(new Vector3(0, -accel*upfactor, 0));
		}
		if (Key.getCode() == Key.RIGHT) {
			ps.dynamicEntities[player][ParticleSystem.ENTITY].force = ps.dynamicEntities[0][ParticleSystem.ENTITY].force.add(new Vector3(accel, 0, 0));
			if ( ps.dynamicEntities[player][ParticleSystem.CLIP].dir != "right" ) {
				ps.dynamicEntities[player][ParticleSystem.CLIP].gotoAndStop("right");			
				ps.dynamicEntities[player][ParticleSystem.CLIP].dir = "right";				
			}
		}
		if (Key.getCode() == Key.LEFT) {
			ps.dynamicEntities[player][ParticleSystem.ENTITY].force = ps.dynamicEntities[0][ParticleSystem.ENTITY].force.add(new Vector3(-accel, 0, 0));
			if ( ps.dynamicEntities[player][ParticleSystem.CLIP].dir != "left" ) {
				ps.dynamicEntities[player][ParticleSystem.CLIP].gotoAndStop("left");			
				ps.dynamicEntities[player][ParticleSystem.CLIP].dir = "left";				
			}
		}
	};
	Key.addListener(keyListener);	
}

function findAvatar():Number {
	for (var i = 0; i < ps.dynamicEntities.length; i++) {
		if ( ps.dynamicEntities[i][ParticleSystem.CLIP]._name == "avatar" ) {
			return i;
			in 
		}
	}
}

function randRange(min:Number, max:Number):Number {
    var randomNum:Number = Math.floor(Math.random() * (max - min + 1)) + min;
    return randomNum;
}
