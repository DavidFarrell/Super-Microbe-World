/*
Copyright (c) 2006, 2007 Alec Cove

Permission is hereby granted, free of charge, to any person obtaining a copy of this 
software and associated documentation files (the "Software"), to deal in the Software 
without restriction, including without limitation the rights to use, copy, modify, 
merge, publish, distribute, sublicense, and/or sell copies of the Software, and to 
permit persons to whom the Software is furnished to do so, subject to the following 
conditions:

The above copyright notice and this permission notice shall be included in all copies 
or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, 
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A 
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT 
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF 
CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE 
OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/*
TODO:
- review how the WheelParticle needs to have the o value passed during collision
- clear up the difference between speed and angularVelocity
- can the wheel rotate steadily using speed? angularVelocity causes (unwanted?) acceleration
*/

import physics.ape.*;


/**
 * A particle that simulates the behavior of a wheel 
 */ 
class physics.ape.WheelParticle extends CircleParticle {

	private var rp:RimParticle;
	private var tan:Vector;	
	private var normSlip:Vector;
	private var orientation:Vector;
	
	private var _traction:Number;
	

	/**
	 * @param x The initial x position.
	 * @param y The initial y position.
	 * @param radius The radius of this particle.
	 * @param fixed Determines if the particle is fixed or not. Fixed particles
	 * are not affected by forces or collisions and are good to use as surfaces.
	 * Non-fixed particles move freely in response to collision and forces.
	 * @param mass The mass of the particle
	 * @param elasticity The elasticity of the particle. Higher values mean more elasticity.
	 * @param friction The surface friction of the particle. 
	 * @param traction The surface traction of the particle.
	 * <p>
	 * Note that WheelParticles can be fixed but rotate freely.
	 * </p>
	 */
	function WheelParticle(
			x:Number, 
			y:Number, 
			radius:Number, 
			fixed:Boolean, 
			mass:Number, 
			elasticity:Number,
			friction:Number,
			traction:Number) {

		super(x,y,radius,fixed, mass, elasticity, friction);
		
		(mass == undefined) ? (this.mass = 1) : (this.mass = mass);
		(elasticity == undefined) ? (this.elasticity = 0.3) : (this.elasticity = elasticity);
		(friction == undefined) ? (this.friction = 0) : (this.friction = friction);
		(traction == undefined) ? (_traction = 1) : (_traction = traction);		
		
		tan = new Vector(0,0);
		normSlip = new Vector(0,0);
		rp = new RimParticle(radius, 2); 	
		
		orientation = new Vector();
	}	

	
	/**
	 * The speed of the WheelParticle. You can alter this value to make the 
	 * WheelParticle spin.
	 */
	public function get speed():Number {
		return rp.speed;
	}
	
	
	/**
	 * @private
	 */		
	public function set speed(s:Number):Void {
		rp.speed = s;
	}

	
	/**
	 * The angular velocity of the WheelParticle. You can alter this value to make the 
	 * WheelParticle spin.
	 */
	public function get angularVelocity():Number {
		return rp.angularVelocity;
	}
	
	
	/**
	 * @private
	 */		
	public function set angularVelocity(a:Number):Void {
		rp.angularVelocity = a;
	}
	
	
	/**
	 * The amount of traction during a collision. This property controls how much traction is 
	 * applied when the WheelParticle is in contact with another particle. If the value is set
	 * to 0, there will be no traction and the WheelParticle will behave as if the 
	 * surface was totally slippery, like ice. Values should be between 0 and 1. 
	 * 
	 * <p>
	 * Note that the friction property behaves differently than traction. If the surface 
	 * friction is set high during a collision, the WheelParticle will move slowly as if
	 * the surface was covered in glue.
	 * </p>
	 */		
	public function get traction():Number {
		return 1 - _traction;
	}


	/**
	 * @private
	 */				
	public function set traction(t:Number):Void {
		_traction = 1 - t;
	}
	
	
	/**
	 * The default paint method for the particle. Note that you should only use
	 * the default painting methods for quick prototyping. For anything beyond that
	 * you should always write your own classes that either extend one of the
	 * APE particle and constraint classes, or is a composite of them. Then within that 
	 * class you can define your own custom painting method.
	 */
	public  function paint( screenOffsetX : Number ):Void {
		sprite._x = curr.x - screenOffsetX;
		sprite._y = curr.y;
		sprite._rotation = angle;	
	}


	/**
	 * Sets up the visual representation of this particle. This method is automatically called when 
	 * an particle is added to the engine.
	 */
	public  function init():Void {
		cleanup();
		if (displayObject != undefined) {
			initDisplay();
		} else {
			
			sprite.clear();
			sprite.lineStyle(lineThickness, lineColor, lineAlpha);
			
			// wheel circle
			sprite.beginFill(fillColor, fillAlpha);
			drawCircle(sprite, 0, 0, radius);
			sprite.endFill();
			
			// spokes
			sprite.moveTo(-radius, 0);
			sprite.lineTo( radius, 0);
			sprite.moveTo(0, -radius);
			sprite.lineTo(0, radius);
		}
		paint(0);
	}
	
	
	
	private function drawCircle (clip, vx, vy, r) {
		// clip = movieclip to draw in
		// vx = x-loc to start from
		// vy = y-loc to start from
		// r = radius of circle
		
		var x = vx;
		var y = vy;

		clip.moveTo(x+r, y);
		clip.curveTo(r+x, 0.4142*r+y, 0.7071*r+x, 0.7071*r+y);
		clip.curveTo(0.4142*r+x, r+y, x, r+y);
		clip.curveTo(-0.4142*r+x, r+y, -0.7071*r+x, 0.7071*r+y);
		clip.curveTo(-r+x, 0.4142*r+y, -r+x, y);
		clip.curveTo(-r+x, -0.4142*r+y, -0.7071*r+x, -0.7071*r+y);
		clip.curveTo(-0.4142*r+x, -r+y, x, -r+y);
		clip.curveTo(0.4142*r+x, -r+y, 0.7071*r+x, -0.7071*r+y);
		clip.curveTo(r+x, -0.4142*r+y, r+x, y);
	}
 
	


	/**
	 * The rotation of the wheel in radians.
	 */
	public function get radian():Number {
		orientation.setTo(rp.curr.x, rp.curr.y);
		return Math.atan2(orientation.y, orientation.x) + Math.PI;
	} 


	/**
	 * The rotation of the wheel in degrees.
	 */
	public function get angle():Number {
		return radian * MathUtil.ONE_EIGHTY_OVER_PI;
	} 

	
	/**
	 *
	 */			
	public  function update(dt:Number):Void {
		super.update(dt);
		rp.update(dt);
	}


	/**
	 * @private
	 */		
	public  function resolveCollision(
			mtd:Vector, vel:Vector, n:Vector, d:Number, o:Number, p:AbstractParticle):Void {
		
		// review the o (order) need here - its a hack fix
		super.resolveCollision(mtd, vel, n, d, o, p);
		resolve(n.mult(MathUtil.sign(d * o)));
	}
	

	/**
	 * simulates torque/wheel-ground interaction - n is the surface normal
	 * Origins of this code thanks to Raigan Burns, Metanet software
	 */
	private function resolve(n:Vector):Void {

		// this is the tangent vector at the rim particle
		tan.setTo(-rp.curr.y, rp.curr.x);

		// normalize so we can scale by the rotational speed
		tan = tan.normalize();

		// velocity of the wheel's surface 
		var wheelSurfaceVelocity:Vector = tan.mult(rp.speed);
		
		// the velocity of the wheel's surface relative to the ground
		var combinedVelocity:Vector = velocity.plusEquals(wheelSurfaceVelocity);
	
		// the wheel's comb velocity projected onto the contact normal
		var cp:Number = combinedVelocity.cross(n);

		// set the wheel's spinspeed to track the ground
		tan.multEquals(cp);
		rp.prev.copy(rp.curr.minus(tan));

		// some of the wheel's torque is removed and converted into linear displacement
		var slipSpeed:Number = 1 - (_traction * rp.speed);
		//trace (_traction + " " + rp.speed);
		//trace("slip speed " + slipSpeed);
		normSlip.setTo(slipSpeed * n.y, slipSpeed * n.x);
		curr.plusEquals(normSlip);
		rp.speed *= _traction;	
	}
}


