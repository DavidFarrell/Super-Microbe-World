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
- tearable, tearLength
- consider breaking the collidable (vs non collidable) functionality into another class
- get/set collidable, currently it is only get
- see if radian, angle, and center can be more efficient
- do we need a scaleToLength for non collidable?
- resolveCycles
*/


import physics.ape.*;




/**
 * A Spring-like constraint that connects two particles
 */
class physics.ape.SpringConstraint extends AbstractConstraint {
	
	private var p1:AbstractParticle;
	private var p2:AbstractParticle;	

	private var _restLength:Number;
	private var _collidable:Boolean;
	private var _scp:SpringConstraintParticle;
	
	public var lineThickness:Number = 1;
	public var lineColor:Number = 0x000000;
	public var lineAlpha:Number = 100;
	public var fillColor:Number = 0x000000;
	public var fillAlpha:Number = 100;

	
	
	/**
	 * @param p1 The first particle this constraint is connected to.
	 * @param p2 The second particle this constraint is connected to.
	 * @param stiffness The strength of the spring. Valid values are between 0 and 1. Lower values
	 * result in softer springs. Higher values result in stiffer, stronger springs.
	 * @param collidable Determines if the constraint will be checked for collision
	 * @param rectHeight If the constraint is collidable, the height of the collidable area
	 * can be set in pixels. The height is perpendicular to the two attached particles.
	 * @param rectScale If the constraint is collidable, the scale of the collidable area
	 * can be set in value from 0 to 1. The scale is percentage of the distance between 
	 * the the two attached particles.
	 * @param scaleToLength If the constraint is collidable and this value is true, the 
	 * collidable area will scale based on changes in the distance of the two particles. 
	 */
	function SpringConstraint(
			p1:AbstractParticle, 
			p2:AbstractParticle, 
			stiffness:Number,
			collidable:Boolean,
			rectHeight:Number,
			rectScale:Number,
			scaleToLength:Boolean) {
		
		super(stiffness);
		
		var stiff:Number;
		var collide:Boolean;
		var rect_height:Number;
		var rect_scale:Number;
		var scale_to_length:Boolean;
		
		(stiffness == undefined) ? (stiff = 0.5) : (stiff = stiffness);
		(collidable == undefined) ? (collide = false) : (collide = collidable);		
		(rectHeight == undefined) ? (rect_height = 1) : (rect_height = rectHeight);
		(rectScale == undefined) ? (rect_scale = 1) : (rect_scale = rectScale);
		(scaleToLength == undefined) ? (scale_to_length = false) : (scale_to_length = scaleToLength);
		

		
		this.p1 = p1;
		this.p2 = p2;
		checkParticlesLocation();
		
		_restLength = currLength;
		setCollidable(collide, rect_height, rect_scale, scale_to_length);
	}
	
	
	/**
	 * The rotational value created by the positions of the two particles attached to this
	 * SpringConstraint. You can use this property to in your own painting methods, along with the 
	 * <code>center</code> property. 
	 * 
	 * @returns A Number representing the rotation of this SpringConstraint in radians
	 */			
	public function get radian():Number {
		var d:Vector = delta;
		return Math.atan2(d.y, d.x);
	}
	
	
	/**
	 * The rotational value created by the positions of the two particles attached to this
	 * SpringConstraint. You can use this property to in your own painting methods, along with the 
	 * <code>center</code> property. 
	 * 
	 * @returns A Number representing the rotation of this SpringConstraint in degrees
	 */					
	public function get angle():Number {
		return radian * MathUtil.ONE_EIGHTY_OVER_PI;
	}
	
			
	/**
	 * The center position created by the relative positions of the two particles attached to this
	 * SpringConstraint. You can use this property to in your own painting methods, along with the 
	 * rotation property.
	 * 
	 * @returns A Vector representing the center of this SpringConstraint
	 */			
	public function get center():Vector {
		return (p1.curr.plus(p2.curr)).divEquals(2);
	}
	
	
	/**
	 * If the <code>collidable</code> property is true, you can set the scale of the collidible area
	 * between the two attached particles. Valid values are from 0 to 1. If you set the value to 1, then
	 * the collision area will extend all the way to the two attached particles. Setting the value lower
	 * will result in an collision area that spans a percentage of that distance. Setting the value
	 * higher will cause the collision rectangle to extend past the two end particles.
	 */		 	
	public function set rectScale(s:Number):Void {
		if (scp == undefined) return;
		scp.rectScale = s;
	}
	
	
	/**
	 * @private
	 */			
	public function get rectScale():Number {
		return scp.rectScale;
	}
	
	
	/**
	 * Returns the length of the SpringConstraint, the distance between its two 
	 * attached particles.
	 */ 
	public function get currLength():Number {
		return p1.curr.distance(p2.curr);
	}
	
	
	/**
	 * If the <code>collidable</code> property is true, you can set the height of the 
	 * collidible rectangle between the two attached particles. Valid values are greater 
	 * than 0. If you set the value to 10, then the collision rect will be 10 pixels high.
	 * The height is perpendicular to the line connecting the two particles
	 */	 
	public function get rectHeight():Number {
		return scp.rectHeight;
	}
	
	
	/**
	 * @private
	 */	
	public function set rectHeight(h:Number):Void {
		if (scp == undefined) return;
		scp.rectHeight = h;
	}			
	
		
	/**
	 * The <code>restLength</code> property sets the length of SpringConstraint. This value will be
	 * the distance between the two particles unless their position is altered by external forces. 
	 * The SpringConstraint will always try to keep the particles this distance apart. Values must 
	 * be > 0.
	 */			
	public function get restLength():Number {
		return _restLength;
	}
	
	
	/**
	 * @private
	 */	
	public function set restLength(r:Number):Void {
		/* if (r <= 0) throw new ArgumentError("restLength must be greater than 0"); */
		_restLength = r;
	}
	
		
	/**
	 * Determines if the area between the two particles is tested for collision. If this value is on
	 * you can set the <code>rectHeight</code> and <code>rectScale</code> properties 
	 * to alter the dimensions of the collidable area.
	 */			
	public function get collidable():Boolean {
		return _collidable;
	}
	
	
	/**
	 * For cases when the SpringConstraint is <code>collidable</code> and only one of the
	 * two end particles are fixed. This value will dispose of collisions near the
	 * fixed particle, to correct for situations where the collision could never be
	 * resolved. Values must be between 0.0 and 1.0.
	 */	
	public function get fixedEndLimit():Number {
		return scp.fixedEndLimit;
	}	
			
			
	/**
	 * @private
	 */	
	public function set fixedEndLimit(f:Number):Void {
		if (scp == undefined) return;
		scp.fixedEndLimit = f;
	}
	
				
	/**
	 *
	 */		
	public function setCollidable(b:Boolean, rectHeight:Number, 
			rectScale:Number, scaleToLength:Boolean):Void {
		
		var scale_to_length:Boolean;
		(scaleToLength == undefined) ? (scale_to_length = false) : (scale_to_length = scaleToLength);
		
		_collidable = b;
		_scp = undefined;
		
		if (_collidable) {
			_scp = new SpringConstraintParticle(p1, p2, this, rectHeight, rectScale, scale_to_length);			
		}
	}
	
	
	/**
	 * Returns true if the passed particle is one of the two particles attached to this SpringConstraint.
	 */		
	public function isConnectedTo(p:AbstractParticle):Boolean {
		return (p == p1 || p == p2);
	}
	
	
	/**
	 * Returns true if both connected particle's <code>fixed</code> property is true.
	 */
	public function get fixed():Boolean {
	
		var isFixed:Boolean = false;
		
		if (p1.fixed && p2.fixed) {
			isFixed = true;
		}
	
		return (isFixed);
	}
	
	
	/**
	 * Sets up the visual representation of this SpringContraint. This method is called 
	 * automatically when an instance of this SpringContraint's parent Group is added to 
	 * the APEngine, when  this SpringContraint's Composite is added to a Group, or this 
	 * SpringContraint is added to a Composite or Group.
	 */			
	public  function init():Void {	
		cleanup();
		if (collidable) {
			scp.init();
		} else if (displayObject != undefined) {
			initDisplay();
		}
		paint(0);
	}
	
			
	/**
	 * The default painting method for this constraint. This method is called automatically
	 * by the <code>APEngine.paint()</code> method. If you want to define your own custom painting
	 * method, then create a subclass of this class and override <code>paint()</code>.
	 */			
	public  function paint( screenOffsetX : Number ):Void {
		
		if (collidable) {
			scp.paint( screenOffsetX );
		} else if (displayObject != undefined) {
			var c:Vector = center;
			sprite._x = c.x - screenOffsetX; 
			sprite._y = c.y;
			sprite._rotation = angle;
		} else {
			sprite.clear();
			sprite.lineStyle(lineThickness, lineColor, lineAlpha);
			sprite.moveTo(p1.px, p1.py);
			sprite.lineTo(p2.px, p2.py);	
		}
	}
	
	
	/**
	 * Assigns a DisplayObject to be used when painting this constraint.
	 */ 
	public function setDisplay(d:MovieClip, offsetX:Number, 
			offsetY:Number, rotation:Number):Void {
		
		var offset_x:Number;
		var offset_y:Number;
		var rotate:Number;
		
		(offsetX == undefined) ? (offset_x = 0) : (offset_x = offsetX);
		(offsetY == undefined) ? (offset_y = 0) : (offset_y = offsetY);
		
		if (collidable) {
			scp.setDisplay(d, offset_x, offset_y, rotate);
		} else {
			displayObject = d;
			displayObjectRotation = rotate;
			displayObjectOffset = new Vector(offset_x, offset_y);
		}
	}
	

	
	
	/**
	 * @private
	 */
	public function initDisplay():Void {
		if (collidable) {
			scp.initDisplay();
		} else {
			displayObject._x = displayObjectOffset.x;
			displayObject._y = displayObjectOffset.y;
			displayObject._rotation = displayObjectRotation;
		}
	}
	
						
	/**
	 * @private
	 */		
	public function get delta():Vector {
		return p1.curr.minus(p2.curr);
	}		


	/**
	 * @private
	 */		
	public function get scp():SpringConstraintParticle {
		return _scp;
	}
	
	
	/**
	 * @private
	 */			
	public  function resolve():Void {
		
		if (p1.fixed && p2.fixed) return;
		
		var deltaLength:Number = currLength;			
		var diff:Number = (deltaLength - restLength) / (deltaLength * (p1.invMass + p2.invMass));
		var dmds:Vector = delta.mult(diff * stiffness);
	
		p1.curr.minusEquals(dmds.mult(p1.invMass));
		p2.curr.plusEquals (dmds.mult(p2.invMass));
	}
	
	
	/**
	 * if the two particles are at the same location offset slightly
	 */
	private function checkParticlesLocation():Void {
		if (p1.curr.x == p2.curr.x && p1.curr.y == p2.curr.y) {
			p2.curr.x += 0.0001;
		}
	}
}
