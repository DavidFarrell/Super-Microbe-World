
import physics.ape.*;
import physics.ape.demos.*;

/**
 * This is an example showing use of the WheelParticles and collidable
 * SpringConstraints used as surfaces in the 'bridge' area. The bouncy
 * area has a high elasticity setting to push the car back up to the top.
 */
class physics.ape.demos.CarDemo {
	
	private static var colA:Number = 0x334433;
	private static var colB:Number = 0x3366aa;
	private static var colC:Number = 0xaabbbb;
	private static var colD:Number = 0x6699aa;
	private static var colE:Number = 0x778877;

	private var _base:MovieClip;
	private var _holder:MovieClip;
	private var _rotator:Rotator;
	private var _capsule:Capsule;
	private var _surfaces:Surfaces;
	private var _car:Car;
	private var _bridge:Bridge;
	
	public var key_obj:Object;
	
	function CarDemo(baseClip:MovieClip) {
	
		// set up the events, main loop handler, and the engine. you don't have to use
		// enterframe. you just need to call the ApeEngine.step() and ApeEngine.paint() 
		// wherever and however you're handling your program cycle.
		
		_base = baseClip;
		_holder = _base.createEmptyMovieClip("apeHolder", _base.getNextHighestDepth());
		_holder.owner = this;
		_holder._x = -20;
		_holder._y = -45;

		_holder.onEnterFrame = function () {
			this.owner.run();
		}
		
		//_ape = new APEngine(_holder);
		
		// Initialize the engine. The argument here is the time step value. 
		// Higher values scale the forces in the sim, making it appear to run
		// faster or slower. Lower values result in more accurate simulations.
		APEngine.init(1/2);
		
		// set up the default diplay container
		APEngine.container = _holder;
		
		// gravity -- particles of varying masses are affected the same
		APEngine.addMasslessForce(new Vector(0, 3));
		
		// groups - all these classes extend group
		_surfaces = new Surfaces(colA, colB, colC, colD, colE);
		APEngine.addGroup(_surfaces);
		
		//var circle:CircleParticle = new CircleParticle(100, 200, 50);
		//circle.init();
		
		_capsule = new Capsule(colC);
		APEngine.addGroup(_capsule);
		
		_rotator = new Rotator(colB, colE);
		APEngine.addGroup(_rotator);

		_car = new Car(colC, colE);
		APEngine.addGroup(_car);
		
		
		//_bridge = new Bridge(colB, colC, colD);
		//APEngine.addGroup(_bridge);

		
		// determine what collides with what.
		_car.addCollidableList(new Array(_surfaces, _bridge, _capsule));
		_capsule.addCollidableList(new Array(_surfaces, _bridge, _rotator));
		
		
		key_obj = new Object();
		key_obj.owner = this;

		Key.addListener(key_obj);

		key_obj.onKeyDown = function () {
			
			var keySpeed:Number = 0.2;
			
			 var theKey:Number;
			trace(Key.getAscii());
			 switch (Key.getAscii()) {
			 case 97 :
				  theKey = 97;
				  this.owner._car.speed = -keySpeed;
				  
				  break;
			 case 100 :
				  theKey = 100;
				  this.owner._car.speed = keySpeed;
				  trace(this.owner._car.speed);
				  break;
			}
		}
		
		
		key_obj.onKeyUp = function () {
		
			this.owner._car.speed = 0;
		}
		
	}
	
	
	private function run():Void {
		APEngine.step();
		APEngine.paint();
		_rotator.rotateByRadian(.02);
	}
	
			

}

