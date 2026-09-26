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
- Need removeForces method(s)
- Center and Position are the same, needs review.
- Should have alwaysRepaint functionality for Constraints, and bump up to AbstractItem
- See if there's anywhere where Vectors can be downgraded to simple Point classes
*/


import physics.ape.*;

	
/**
 * The abstract base class for all particles.
 * 
 * <p>
 * You should not instantiate this class directly -- instead use one of the subclasses.
 * </p>
 */
class physics.ape.AbstractParticle extends AbstractItem {

	/** @private */
	public /* was internal */ var interval:Interval;
	
	private var forces:Vector;
	private var collision:Collision;
			
	private var _kfr:Number;
	private var _mass:Number;
	private var _invMass:Number;
	private var _friction:Number;
	
	private var _fixed:Boolean;
	private var _collidable:Boolean;
	
	private var _center:Vector;
	private var _multisample:Number;
	
	private var _curr:Vector;
	private var _prev:Vector;
	private var _samp:Vector;
	private var _temp:Vector;
	
	private var _type:String;
		
	
	/** 
	 * @private
	 */
	function AbstractParticle (
			x:Number, 
			y:Number, 
			isFixed:Boolean, 
			mass:Number, 
			elasticity:Number,
			friction:Number) {
		
		/* AS3 feature only
		if (getQualifiedClassName(this) == "org.cove.ape::AbstractParticle") {
			throw new ArgumentError("AbstractParticle can't be instantiated directly");
		}
		*/
		
		
		//super();
		
		(isFixed == undefined) ? (fixed = false) : (fixed = isFixed);
		interval = new Interval(0,0);
		
		_curr = new Vector(x, y);
		_prev = new Vector(x, y);
		_samp = new Vector();
		_temp = new Vector();
		
		forces = new Vector();
		collision = new Collision(new Vector(), new Vector());
		collidable = true;
		
		this.mass = mass;
		this.elasticity = elasticity;
		this.friction = friction;
		
		setStyle();
		
		_center = new Vector();
		_multisample = 0;
	}

	
	/**
	 * The mass of the particle. Valid values are greater than zero. By default, all particles
	 * have a mass of 1. The mass property has no relation to the size of the particle.
	 * 
	 * @throws ArgumentError ArgumentError if the mass is set less than zero. 
	 */
	public function get mass():Number {
		return _mass; 
	}
	
	
	/**
	 * @private
	 */
	public function set mass(m:Number):Void {
		/* if (m <= 0) throw new ArgumentError("mass may not be set <= 0");*/ 
		_mass = m;
		_invMass = 1 / _mass;
	}	

	
	/**
	 * The elasticity of the particle. Standard values are between 0 and 1. 
	 * The higher the value, the greater the elasticity.
	 * 
	 * <p>
	 * During collisions the elasticity values are combined. If one particle's
	 * elasticity is set to 0.4 and the other is set to 0.4 then the collision will
	 * be have a total elasticity of 0.8. The result will be the same if one particle
	 * has an elasticity of 0 and the other 0.8.
	 * </p>
	 * 
	 * <p>
	 * Setting the elasticity to greater than 1 (of a single particle, or in a combined
	 * collision) will cause particles to bounce with energy greater than naturally 
	 * possible.
	 * </p>
	 */ 
	public function get elasticity():Number {
		return _kfr; 
	}
	
	
	/**
	 * @private
	 */
	public function set elasticity(k:Number):Void {
		_kfr = k;
	}
	

	/**
	 * Determines the number of intermediate position steps checked for collision each
	 * cycle. Setting this number higher on fast moving particles can prevent 'tunneling'
	 * -- when a particle moves so fast it misses collision with certain surfaces.
	 */ 
	public function get multisample():Number {
		return _multisample; 
	}
	
	
	/**
	 * @private
	 */
	public function set multisample(m:Number):Void {
		_multisample = m;
	}
	
	
	/**
	 * Returns A Vector of the current location of the particle
	 */	
	public function get center():Vector {
		_center.setTo(px, py)
		return _center;
	}
	
			
	/**
	 * The surface friction of the particle. Values must be in the range of 0 to 1.
	 * 
	 * <p>
	 * 0 is no friction (slippery), 1 is full friction (sticky).
	 * </p>
	 * 
	 * <p>
	 * During collisions, the friction values are summed, but are clamped between 1 and 0.
	 * For example, If two particles have 0.7 as their surface friction, then the resulting
	 * friction between the two particles will be 1 (full friction).
	 * </p>
	 * 
	 * <p>
	 * In the current release, only dynamic friction is calculated. Static friction
	 * is planned for a later release.
	 * </p>
	 *
	 * <p>
	 * There is a bug in the current release where colliding non-fixed particles with friction
	 * greater than 0 will behave erratically. A workaround is to only set the friction of
	 * fixed particles.
	 * </p>
	 * @throws ArgumentError ArgumentError if the friction is set less than zero or greater than 1
	 */	
	public function get friction():Number {
		return _friction; 
	}

	
	/**
	 * @private
	 */
	public function set friction(f:Number):Void {
		/* if (f < 0 || f > 1) throw new ArgumentError("Legal friction must be >= 0 and <=1"); */
		_friction = f;
	}
	
	
	/**
	 * The fixed state of the particle. If the particle is fixed, it does not move
	 * in response to forces or collisions. Fixed particles are good for surfaces.
	 */
	public function get fixed():Boolean {
		return _fixed;
	}


	/**
	 * @private
	 */
	public function set fixed(f:Boolean):Void {
		_fixed = f;
	}
	
	
	public function get curr():Vector {
		return _curr;
	}
	
	public function set curr (c:Vector):Void {
		_curr = c;
	}
	
	public function get prev ():Vector {
		return _prev;
	}
	
	public function set prev (p:Vector):Void {
		_prev = p;
	}
	
	public function get samp ():Vector {
		return _samp;
	}
	
	public function set samp (s:Vector):Void {
		_samp = s;
	}
	
	public function get temp ():Vector {
		return _temp;
	}
	
	public function set temp (t:Vector):Void {
		_temp = t;
	}
	

	public function get type ():String {
		return _type;
	}
	
	public function set type (t:String):Void {
		_type = t;
	}
	
	
	/**
	 * The position of the particle. Getting the position of the particle is useful
	 * for drawing it or testing it for some custom purpose. 
	 * 
	 * <p>
	 * When you get the <code>position</code> of a particle you are given a copy of the current
	 * location. Because of this you cannot change the position of a particle by
	 * altering the <code>x</code> and <code>y</code> components of the Vector you have retrieved from the position property.
	 * You have to do something instead like: <code> position = new Vector(100,100)</code>, or
	 * you can use the <code>px</code> and <code>py</code> properties instead.
	 * </p>
	 * 
	 * <p>
	 * You can alter the position of a particle three ways: change its position, set
	 * its velocity, or apply a force to it. Setting the position of a non-fixed particle
	 * is not the same as setting its fixed property to true. A particle held in place by 
	 * its position will behave as if it's attached there by a 0 length spring constraint. 
	 * </p>
	 */
	public function get position():Vector {
		return new Vector(curr.x,curr.y);
	}
	
	
	/**
	 * @private
	 */
	public function set position(p:Vector):Void {
		curr.copy(p);
		prev.copy(p);
	}


	/**
	 * The x position of this particle
	 */
	public function get px():Number {
		return curr.x;
	}

	
	/**
	 * @private
	 */
	public function set px(x:Number):Void {
		curr.x = x;
		prev.x = x;	
	}


	/**
	 * The y position of this particle
	 */
	public function get py():Number {
		return curr.y;
	}


	/**
	 * @private
	 */
	public function set py(y:Number):Void {
		curr.y = y;
		prev.y = y;	
	}


	/**
	 * The velocity of the particle. If you need to change the motion of a particle, 
	 * you should either use this property, or one of the addForce methods. Generally,
	 * the addForce methods are best for slowly altering the motion. The velocity property
	 * is good for instantaneously setting the velocity, e.g., for projectiles.
	 * 
	 */
	public function get velocity():Vector {
		return curr.minus(prev);
	}
	
	
	/**
	 * @private
	 */	
	public function set velocity(v:Vector):Void {
		prev = curr.minus(v);	
	}
	
	
	/**
	 * Determines if the particle can collide with other particles or constraints.
	 * The default state is true.
	 */
	public function get collidable():Boolean {
		return _collidable;
	}

			
	/**
	 * @private
	 */		
	public function set collidable(b:Boolean):Void {
		_collidable = b;
	}
	
	
	/**
	 * Assigns a DisplayObject to be used when painting this particle.
	 */ 
	public function setDisplay (d:MovieClip, offsetX:Number, offsetY:Number, rotation:Number):Void {
		
		var offset_x:Number;
		var offset_y:Number;
		var rotate:Number;
		
		(offsetX == undefined) ? (offset_x = 0) : (offset_x = offsetX);
		(offsetY == undefined) ? (offset_y = 0) : (offset_y = offsetY);
		(rotation == undefined) ? (rotate = 0) : (rotate = rotation);
	
		displayObject = d;
		displayObjectRotation = rotation;
		displayObjectOffset = new Vector(offsetX, offsetY);
	}
	
	
	/**
	 * Adds a force to the particle. The mass of the particle is taken into 
	 * account when using this method, so it is useful for adding forces 
	 * that simulate effects like wind. Particles with larger masses will
	 * not be affected as greatly as those with smaller masses. Note that the
	 * size (not to be confused with mass) of the particle has no effect 
	 * on its physical behavior with respect to forces.
	 * 
	 * @param f A Vector represeting the force added.
	 */ 
	public function addForce(f:Vector):Void {
		forces.plusEquals(f.mult(invMass));
	}
	
	
	/**
	 * Adds a 'massless' force to the particle. The mass of the particle is 
	 * not taken into account when using this method, so it is useful for
	 * adding forces that simulate effects like gravity. Particles with 
	 * larger masses will be affected the same as those with smaller masses.
	 *
	 * @param f A Vector represeting the force added.
	 */ 	
	public function addMasslessForce(f:Vector):Void {
		forces.plusEquals(f);
	}
	
		
	/**
	 * The <code>update()</code> method is called automatically during the
	 * APEngine.step() cycle. This method integrates the particle.
	 */
	public function update(dt2:Number):Void {
		//trace("is fixed " + fixed);
		if (fixed) return;
		
		// global forces
		addForce(APEngine.force);
		addMasslessForce(APEngine.masslessForce);

		// integrate
		temp.copy(curr);
		
		var nv:Vector = velocity.plus(forces.multEquals(dt2));
		curr.plusEquals(nv.multEquals(APEngine.damping));
		prev.copy(temp);

		// clear the forces
		forces.setTo(0,0);
	}
	
	
	/**
	 * @private
	 */
	public function initDisplay():Void {
		displayObject._x = displayObjectOffset.x;
		displayObject._y = displayObjectOffset.y;
		displayObject._rotation = displayObjectRotation;
	}	
	
		
	/**
	 * @private
	 */		
	public function getComponents(collisionNormal:Vector):Collision {
		var vel:Vector = velocity;
		var vdotn:Number = collisionNormal.dot(vel);
		collision.vn = collisionNormal.mult(vdotn);
		collision.vt = vel.minus(collision.vn);	
		return collision;
	}


	/**
	 * @private
	 */	
	public function resolveCollision(
			mtd:Vector, vel:Vector, n:Vector, d:Number, o:Number, p:AbstractParticle):Void {
				
		curr.plusEquals(mtd);
		velocity = vel;
	}
	
	
	/**
	 * @private
	 */		
	public function get invMass():Number {
		return (fixed) ? 0 : _invMass; 
	}
}	