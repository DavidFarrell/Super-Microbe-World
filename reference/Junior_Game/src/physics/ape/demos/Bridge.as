

import physics.ape.*;

class physics.ape.demos.Bridge extends Group {
	
	function Bridge(colB:Number, colC:Number, colD:Number) {	
		
		// just a cut and paste class here. everything should be parameterized 
		// if you want to do it the right way, eg locations, section size, etc
	
		var bx:Number = 170;
		var by:Number = 50;
		var bsize:Number = 51.5;
		var yslope:Number = 2.4;
		var particleSize:Number = 5;
		
		var bridgePAA:CircleParticle = new CircleParticle(bx,by,particleSize,true);
		bridgePAA.setStyle(1, colC, 100, colB);
		addParticle(bridgePAA);
		
		bx += bsize;
		by += yslope;
		var bridgePA:CircleParticle = new CircleParticle(bx,by,particleSize);
		bridgePA.setStyle(1, colC, 100, colB);
		addParticle(bridgePA);
		
		bx += bsize;
		by += yslope;
		var bridgePB:CircleParticle = new CircleParticle(bx,by,particleSize);
		bridgePB.setStyle(1, colC, 100, colB);
		addParticle(bridgePB);
		
		bx += bsize;
		by += yslope;
		var bridgePC:CircleParticle = new CircleParticle(bx,by,particleSize);
		bridgePC.setStyle(1, colC, 100, colB);
		addParticle(bridgePC);
		
		bx += bsize;
		by += yslope;
		var bridgePD:CircleParticle = new CircleParticle(bx,by,particleSize);
		bridgePD.setStyle(1, colC, 100, colB);
		addParticle(bridgePD);
		
		bx += bsize;
		by += yslope;
		var bridgePDD:CircleParticle = new CircleParticle(bx,by,particleSize,true);
		bridgePDD.setStyle(1, colC, 100, colB);
		addParticle(bridgePDD);
		
		
		var bridgeConnA:SpringConstraint = new SpringConstraint(bridgePAA, bridgePA, 
				0.9, true, 10, 0.8);
		
		// collision response on the bridgeConnA will be ignored on 
		// on the first 1/4 of the constraint. this avoids blow ups
		// particular to springcontraints that have 1 fixed particle.
		bridgeConnA.fixedEndLimit = 0.5;
		bridgeConnA.setStyle(1, colC, 100, colB);
		addConstraint(bridgeConnA);
		
		var bridgeConnB:SpringConstraint = new SpringConstraint(bridgePA, bridgePB, 
				0.9, true, 10, 0.8);
		bridgeConnB.setStyle(1, colC, 100, colB);
		addConstraint(bridgeConnB);
		
		var bridgeConnC:SpringConstraint = new SpringConstraint(bridgePB, bridgePC, 
				0.9, true, 10, 0.8);
		bridgeConnC.setStyle(1, colC, 100, colB);
		addConstraint(bridgeConnC);
		
		var bridgeConnD:SpringConstraint = new SpringConstraint(bridgePC, bridgePD,
				0.9, true, 10, 0.8);
		bridgeConnD.setStyle(1, colC, 100, colB);
		addConstraint(bridgeConnD);
		
		var bridgeConnE:SpringConstraint = new SpringConstraint(bridgePD, bridgePDD, 
				0.9, true, 10, 0.8);
		bridgeConnE.fixedEndLimit = 0.25;
		bridgeConnE.setStyle(1, colC, 100, colB);
		addConstraint(bridgeConnE);
	}
}
