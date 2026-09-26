
import physics.ape.*;

class physics.ape.demos.ApeTest extends MovieClip {
	
	private var _base:MovieClip;
	private var _holder:MovieClip;
	
	public function ApeTest(baseClip:MovieClip) {

		_base = baseClip;
		_holder = _base.createEmptyMovieClip("apeHolder", _base.getNextHighestDepth());
		_holder.owner = this;
		_holder._x = -20;
		_holder._y = -45;
		
		_holder.onEnterFrame = function () {
			this.owner.run();
		}	
	  	
		// set up the default diplay container
		APEngine.container = _holder;
		
		APEngine.init(1/4);
		
	 	// gravity -- particles of varying masses are affected the same
		APEngine.addMasslessForce(new Vector(0, 2));
		
		
		//var circle:CircleParticle = new CircleParticle(100, 200, 50);
		//circle.init();
	
		 var defaultGroup:Group = new Group();
		 defaultGroup.collideInternal = true;

		 var cp:CircleParticle = new CircleParticle(250,10,5);
		 cp.init();
		 defaultGroup.addParticle(cp);

		 var rp:RectangleParticle = new RectangleParticle(250,300,300,50,0,true);
		 defaultGroup.addParticle(rp);
	
		 APEngine.addGroup(defaultGroup);
	}

	private function run() : Void {
		APEngine.step();
		APEngine.paint();
	}
}


