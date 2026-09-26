import physics.ape.*;

class physics.ape.demos.Capsule extends Group {
	
	function Capsule(colC:Number) {
		
		var capsuleP1:CircleParticle = new CircleParticle(300,10,14,false,1.3,0.4);
		capsuleP1.setStyle(0, colC, 100, colC);
		addParticle(capsuleP1);
		
		var capsuleP2:CircleParticle = new CircleParticle(345,35,14,false,1.3,0.4);
		capsuleP2.setStyle(0, colC, 100, colC);
		addParticle(capsuleP2);
		
		var capsule:SpringConstraint = new SpringConstraint(capsuleP1, capsuleP2, 1, false, 24);
		capsule.setStyle(5, colC, 100, colC, 100);
		addConstraint(capsule);
	}
}
