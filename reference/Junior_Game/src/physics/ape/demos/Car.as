

import physics.ape.*;
import physics.ape.demos.*;

class physics.ape.demos.Car extends Group {
	
	private var wheelParticleA:WheelParticle;
	private var wheelParticleB:WheelParticle;
	
	
	public function Car(colC:Number, colE:Number) {
		
		wheelParticleA = new WheelParticle(100,8,15,false,5);
		wheelParticleA.setStyle(0, colC, 100, colE);
		addParticle(wheelParticleA);
		wheelParticleA.sprite.cacheAsBitmap = true;
		
		wheelParticleB = new WheelParticle(180, 8,15,false,5);
		wheelParticleB.setStyle(0, colC, 100, colE);
		addParticle(wheelParticleB);
		wheelParticleB.sprite.cacheAsBitmap = true;
		
		var wheelConnector:SpringConstraint = new SpringConstraint(wheelParticleA, wheelParticleB,
				0.5, true, 20);
		wheelConnector.setStyle(0, colC, 100, colE);
		addConstraint(wheelConnector);
	}
	
	public function get speed():Number {
		return wheelParticleA.angularVelocity;
	}
	
	public function set speed(s:Number):Void {
		wheelParticleA.angularVelocity = s;
		wheelParticleB.angularVelocity = s;
	}
}
