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
- should all getters for composites, particles, constraints arrays return
  a copy of the array? do we want to give the user direct access to it?
- addConstraintList, addParticleList
- if get particles and get constraints returned members of the Groups composites
  (as they probably should, the checkCollision... methods would probably be much
  cleaner.
*/ 

import physics.ape.*;

/**
 * The Group class can contain Particles, Constraints, and Composites. Groups
 * can be assigned to be checked for collision with other Groups or internally. 
 */ 
class physics.ape.Group extends AbstractCollection {
	
	private var _composites:Array;
	private var _collisionList:Array;
	private var _collideInternal:Boolean;
	private var _isColliding:Boolean;
	
	
	/**
	 * The Group class is the main organizational class for APE. Once groups are created and populated 
	 * with particles, constraints, and composites, they are added to the APEngine. Groups may contain
	 * particles, constraints, and composites. Composites may only contain particles and constraints.
	 */
	function Group(collideInternal:Boolean) {
	
	
		var collide_internal:Boolean;
		(collideInternal == undefined) ? (collide_internal = false) : (collide_internal = collideInternal);
		_composites = new Array();
		_collisionList = new Array();
		_collideInternal = collide_internal;
	}
	
	
	/**
	 * Initializes every member of this Group by in turn calling 
	 * each members <code>init()</code> method.
	 */
	public  function init():Void {
		super.init();
		for (var i:Number = 0; i < composites.length; i++) {
			composites[i].init();	
		}
	}
	

	/**
	 * Returns an Array containing all the Composites added to this Group
	 */
	public function get composites():Array {
		return _composites;
	}
	
	
	/**
	 * Adds a Composite to the Group.
	 * 
	 * @param c The Composite to be added.
	 */
	public function addComposite(c:Composite):Void {
		composites.push(c);
		c.isParented = true;
		if (isParented) c.init();
	}


	/**
	 * Removes a Composite from the Group.
	 * 
	 * @param c The Composite to be removed.
	 */
	public function removeComposite(c:Composite):Void {
		var cpos:Number = composites.indexOf(c);
		if (cpos == -1) return;
		composites.splice(cpos, 1);
		c.isParented = false;
		c.cleanup();
	}
	

	/**
	 * Paints all members of this Group. This method is called automatically
	 * by the APEngine class.
	 */
	public  function paint( screenOffsetX : Number ):Void {

		super.paint(screenOffsetX);
	
		var len:Number = _composites.length;
		for (var i:Number = 0; i < len; i++) {
			var c:Composite = _composites[i];
			c.paint(screenOffsetX);
		}						
	}


	/**
	 * Adds an Group instance to be checked for collision against
	 * this one.
	 */
	public function addCollidable(g:Group):Void {
		 collisionList.push(g);
	}


	/**
	 * Removes a Group from the collidable list of this Group.
	 */
	public function removeCollidable(g:Group):Void {
		var pos:Number = collisionList.indexOf(g);
		if (pos == -1) return;
		collisionList.splice(pos, 1);
	}


	/**
	 * Adds an array of AbstractCollection instances to be checked for collision 
	 * against this one.
	 */
	public function addCollidableList(list:Array):Void {
		 for (var i:Number = 0; i < list.length; i++) {
			var g:Group = list[i];
			collisionList.push(g);
		 }
	}
	
	
	/**
	 * Returns the array of every Group assigned to collide with 
	 * this Group instance.
	 */
	public function get collisionList():Array {
		return _collisionList;
	}	


	/**
	 * Returns an array of every particle, constraint, and composite added to the Group.
	 */
	public  function getAll():Array {
		return particles.concat(constraints).concat(composites);
	}	

					
	/**
	 * Determines if the members of this Group are checked for
	 * collision with one another.
	 */
	public function get collideInternal():Boolean {
		return _collideInternal;
	}
	
	
	/**
	 * @private
	 */
	public function set collideInternal(b:Boolean):Void {
		_collideInternal = b;
	}
	
	
	/**
	 * Calls the <code>cleanup()</code> method of every member of this Group.
	 * The cleanup() method is called automatically when an Group is removed
	 * from the APEngine.
	 */
	public  function cleanup():Void {
		super.cleanup();
		for (var i:Number = 0; i < composites.length; i++) {
			composites[i].cleanup();	
		}
	}
	
			
	/**
	 * @private
	 */
	public  function integrate(dt2:Number):Void {
		
		super.integrate(dt2);
	
		var len:Number = _composites.length;
		for (var i:Number = 0; i < len; i++) {
			var cmp:Composite = _composites[i];
			cmp.integrate(dt2);
		}						
	}
	
	
	/**
	 * @private
	 */
	public  function satisfyConstraints():Void {
		
		super.satisfyConstraints();
	
		var len:Number = _composites.length;
		for (var i:Number = 0; i < len; i++) {
			var cmp:Composite = _composites[i];
			cmp.satisfyConstraints();
		}				
	}
	
	
	/**
	 * @private
	 */
	 /*
	public function checkCollisions():Boolean {
		
		var isColliding:Boolean = false;
		
		if (collideInternal) {
			var collide = checkCollisionGroupInternal();
			if (collide) { isColliding = true; };
		}
		

		
		var len:Number = collisionList.length;
		for (var i:Number = 0; i < len; i++) {
			var g:Group = collisionList[i];
			var collide = checkCollisionVsGroup(g);
			if (collide) { isColliding = true; };
		}
		
		return isColliding;
	}
	*/
	
	
	public function checkCollisions():Boolean {
		
		var isColliding:Boolean = false;
		
		if (collideInternal) {
			var collide = checkCollisionGroupInternal();
			if (collide) { isColliding = true; };
		}
		
		//trace("collision array " + collisionList);
		
		var len:Number = collisionList.length;
		//trace("len " + len);
		
		for (var i:Number = 0; i < len; i++) {
			var g:Group = collisionList[i];
			//trace(collisionList[i]);
			var collide = checkCollisionVsGroup(g);
			if (collide) { isColliding = true; };
			//trace("checkCollisions " + isColliding);
		}
		
		_isColliding = isColliding;
				
		
		return isColliding;
	}
	

	
	
	private function checkCollisionGroupInternal():Boolean {
		
		var isColliding:Boolean = false;
		
		// check collisions not in composites
		var collide = checkInternalCollisions();
		if (collide) { isColliding = true; };
		
		// for every composite in this Group..
		var clen:Number = _composites.length;
		for (var j:Number = 0; j < clen; j++) {
			
			var ca:Composite = _composites[j];
			
			// .. vs non composite particles and constraints in this group
			var collide = ca.checkCollisionsVsCollection(this);
			if (collide) { isColliding = true; };
						
			// ...vs every other composite in this Group
			for (var i:Number = j + 1; i < clen; i++) {
				var cb:Composite = _composites[i];
				var collide = ca.checkCollisionsVsCollection(cb);
				if (collide) { isColliding = true; };
			}
		}
		
		return isColliding;
	}
	
	
	private function checkCollisionVsGroup(g:Group):Boolean {
		
		var isColliding:Boolean = false;
		
		// check particles and constraints not in composites of either group
		var collide = checkCollisionsVsCollection(g);
		if (collide) { isColliding = true; };
		
		var clen:Number = _composites.length;
		var gclen:Number = g.composites.length;
		
		// for every composite in this group..
		for (var i:Number = 0; i < clen; i++) {
		
			// check vs the particles and constraints of g
			var c:Composite = _composites[i];
			var collide = c.checkCollisionsVsCollection(g);
			if (collide) { isColliding = true; };
					
			// check vs composites of g
			for (var j:Number = 0; j < gclen; j++) {
				var gc:Composite = g.composites[j];
				var collide = c.checkCollisionsVsCollection(gc);
				if (collide) { isColliding = true; };
			}
		}
		
		// check particles and constraints of this group vs the composites of g
		for (j = 0; j < gclen; j++) {
			gc = g.composites[j];	
			var collide = checkCollisionsVsCollection(gc);
			if (collide) { isColliding = true; };
		}
				//trace("******* checkCollisionsVsGroup ********* " + isColliding);
		return isColliding;
	}
	
	public function get colliding ():Boolean {
		return _isColliding;
	}
}