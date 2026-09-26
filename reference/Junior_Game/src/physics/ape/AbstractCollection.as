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
- get sprite() is duplicated in AbstractItem. Should be in some parent class.
- checkCollisionsVsCollection and checkInternalCollisions methods use SpringConstraint. 
	it should be AbstractConstraint but the isConnectedTo method is in SpringConstraint.
 - same deal with the paint() method here -- needs to test connected particles state 
	using SpringConstraint methods but should really be AbstractConstraint. need to clear up
	what an AbstractConstraint really means.
 - would an explicit cast be more efficient in the paint() method here?
*/

/* version 1.01
	1.01 - Changed checkCollisionsVsCollection() method to return Boolean on collision test
*/

import physics.ape.*;


/**
 * The abstract base class for all grouping classes. 
 * 
 * <p>
 * You should not instantiate this class directly -- instead use one of the subclasses.
 * </p>
 */	
class physics.ape.AbstractCollection {
	
	private var _base:MovieClip;
	private var _sprite:MovieClip;
	private var _particles:Array;
	private var _constraints:Array;
	private var _isParented:Boolean;
	
	public var _isColliding:Boolean;
	
	
	function AbstractCollection(baseClip:MovieClip) {
	
		/*  AS3 only
		if (getQualifiedClassName(this) == "org.cove.ape::AbstractCollection") {
			throw new ArgumentError("AbstractCollection can't be instantiated directly");
		}
		*/
		
		_base = baseClip;
		_isParented = false;
		_particles = new Array();
		_constraints = new Array();
		
		_isColliding = false;
	}
	
	
	/**
	 * The Array of all AbstractParticle instances added to the AbstractCollection
	 */
	public function get particles():Array {
		return _particles;
	}
	
	
	/**
	 * The Array of all AbstractConstraint instances added to the AbstractCollection
	 */	
	public function get constraints():Array {
		return _constraints;	
	}

	
	/**
	 * Adds an AbstractParticle to the AbstractCollection.
	 * 
	 * @param p The particle to be added.
	 */
	public function addParticle(p:AbstractParticle):Void {
		particles.push(p);
		if (isParented) p.init();
	}
	
	
	/**
	 * Removes an AbstractParticle from the AbstractCollection.
	 * 
	 * @param p The particle to be removed.
	 */
	public function removeParticle(p:AbstractParticle):Void {
		var ppos:Number = particles.indexOf(p);
		
		if (ppos == -1) return;
		particles.splice(ppos, 1);
		p.cleanup();
	}
	
	/**
	 * Cuts an AbstractParticle from the AbstractCollection.
	 * 
	 * @param p The particle to be removed.
	 */
	public function cutParticle(p:AbstractParticle): AbstractParticle {
		var ppos:Number = particles.indexOf(p);
		
//p.curr.x = 999;
				
		for ( var i: Number = 0; i < particles.length; i++ ){
			//trace ("does "+i + " equal p?- " + (p ==  particles[i]) );
			//trace( "P has: " + p.curr.x + "," + p.curr.y + " and current i("+i+") has " + particles[i].curr.x +"," +particles[i].curr.y);
			if ( p == particles[i]) {
				ppos = i;
			}
		}

		
		if (ppos == -1 || isNaN(ppos)) {
			return;
		} else{
			var found  = particles.splice(ppos, 1);
			found = AbstractParticle(found[0]);
//			trace ("found is : " + found + " of " + found._type);
			return found;
		}
	}
	
	
	/**
	 * Adds a constraint to the Collection.
	 * 
	 * @param c The constraint to be added.
	 */
	public function addConstraint(c:AbstractConstraint):Void {
		constraints.push(c);
		if (isParented) c.init();
	}


	/**
	 * Removes a constraint from the Collection.
	 * 
	 * @param c The constraint to be removed.
	 */
	public function removeConstraint(c:AbstractConstraint):Void {
		var cpos:Number = constraints.indexOf(c);
		if (cpos == -1) return;
		constraints.splice(cpos, 1);
		c.cleanup();
	}
	
	
	/**
	 * Initializes every member of this AbstractCollection by in turn calling 
	 * each members <code>init()</code> method.
	 */
	public function init():Void {
		
		for (var i:Number = 0; i < particles.length; i++) {
			particles[i].init();	
		}
		for (i = 0; i < constraints.length; i++) {
			constraints[i].init();
		}
	}
	
			
	/**
	 * paints every member of this AbstractCollection by calling each members
	 * <code>paint()</code> method.
	 */
	public function paint( screenOffsetX : Number ):Void {
		
		var p:AbstractParticle;
		var len:Number = _particles.length;
		for (var i:Number = 0; i < len; i++) {
			p = _particles[i];
			if ((! p.fixed) || p.alwaysRepaint) p.paint(screenOffsetX);	
		}
		
		var c:SpringConstraint;
		len = _constraints.length;
		for (i = 0; i < len; i++) {
			c = _constraints[i];
			if ((! c.fixed) || c.alwaysRepaint) c.paint(screenOffsetX);
		}
	}
	
	
	/**
	 * Calls the <code>cleanup()</code> method of every member of this AbstractCollection.
	 * The cleanup() method is called automatically when an AbstractCollection is removed
	 * from its parent.
	 */
	public function cleanup():Void {
		
		for (var i:Number = 0; i < particles.length; i++) {
			particles[i].cleanup();	
		}
		for (i = 0; i < constraints.length; i++) {
			constraints[i].cleanup();
		}
	}
			
	
	/**
	 * Provides a Sprite to use as a container for drawing or adding children. When the
	 * sprite is requested for the first time it is automatically added to the global
	 * container in the APEngine class.
	 */	
	public function get sprite():MovieClip {
		if (_sprite != undefined) return _sprite;
		
		/*
		if (_base == undefined) {
			throw new Error("The container property of the APEngine class has not been set");
		}
		*/
		
		var spriteName:String = "sprite" + _base.numChildren++ +"_mc";
		_sprite = _base.createEmptyMovieClip(spriteName, _base.getNextHighestDepth());
		_sprite.numChildren = 0;
		
		return _sprite;
	}
	

	/**
	 * Returns an array of every particle and constraint added to the AbstractCollection.
	 */
	public function getAll():Array {
		return particles.concat(constraints);
	}	
	
	
	/**
	 * @private
	 */
	public function get isParented():Boolean {
		return _isParented;
	}	


	/**
	 * @private
	 */		
	public function set isParented(b:Boolean):Void {
		_isParented = b;
	}	
	
							
	/**
	 * @private
	 */
	public function integrate(dt2:Number):Void {
		var len:Number = _particles.length;
		for (var i:Number = 0; i < len; i++) {
			var p:AbstractParticle = _particles[i];
			p.update(dt2);	
		}
	}		
	
		
	/**
	 * @private
	 */
	public function satisfyConstraints():Void {
		var len:Number = _constraints.length;
		for (var i:Number = 0; i < len; i++) {
			var c:AbstractConstraint = _constraints[i];
			c.resolve();	
		}
	}			
	

	/**
	 * @private
	 */	
	 public function checkInternalCollisions():Boolean {
	 
		var isColliding:Boolean = false;
	 
		// every particle in this AbstractCollection
		var plen:Number = _particles.length;
		for (var j:Number = 0; j < plen; j++) {
			
			var pa:AbstractParticle = _particles[j];
			if (! pa.collidable) continue;
			
			// ...vs every other particle in this AbstractCollection
			for (var i:Number = j + 1; i < plen; i++) {
				var pb:AbstractParticle = _particles[i];
				if (pb.collidable) { 
					var collide = CollisionDetector.test(pa, pb);
					if (collide) { isColliding = true; };
				}
			}
			
			// ...vs every other constraint in this AbstractCollection
			var clen:Number = _constraints.length;
			for (var n:Number = 0; n < clen; n++) {
				var c:SpringConstraint = _constraints[n];
				if (c.collidable && ! c.isConnectedTo(pa)) {
					c.scp.updatePosition();
					var collide = CollisionDetector.test(pa, c.scp);
					if (collide) { isColliding = true; };
				}
			}
		}
		

		
		return isColliding;
	}


	/**
	 * @private
	 */	
	public function checkCollisionsVsCollection(ac:AbstractCollection):Boolean {
		
		var isColliding:Boolean = false;
		
		// every particle in this collection...
		var plen:Number = _particles.length;
		for (var j:Number = 0; j < plen; j++) {
			
			var pga:AbstractParticle = _particles[j];
			if (! pga.collidable) continue;
			
			// ...vs every particle in the other collection
			var acplen:Number = ac.particles.length;
			for (var x:Number = 0; x < acplen; x++) {
				var pgb:AbstractParticle = ac.particles[x];
				if (pgb.collidable) {
					var collide = CollisionDetector.test(pga, pgb);
					if (collide) { isColliding = true; };
				}
			}
			// ...vs every constraint in the other collection
			var acclen:Number = ac.constraints.length;
			for (x = 0; x < acclen; x++) {
				var cgb:SpringConstraint = ac.constraints[x];
				if (cgb.collidable && ! cgb.isConnectedTo(pga)) {
					cgb.scp.updatePosition();
					var collide = CollisionDetector.test(pga, cgb.scp);
					if (collide) { isColliding = true; };
				}
			}
		}
		
		// every constraint in this collection...
		var clen:Number = _constraints.length;
		for (j = 0; j < clen; j++) {
			var cga:SpringConstraint = _constraints[j];
			if (! cga.collidable) continue;
			
			// ...vs every particle in the other collection
			acplen = ac.particles.length;
			for (var n:Number = 0; n < acplen; n++) {
				pgb = ac.particles[n];
				if (pgb.collidable && ! cga.isConnectedTo(pgb)) {
					cga.scp.updatePosition();
					var collide = CollisionDetector.test(pgb, cga.scp);
					if (collide) { isColliding = true; };
				}
			}
		}
		
		
		_isColliding = isColliding;
		
		return isColliding;
	}
	
	

	
	

	
}



