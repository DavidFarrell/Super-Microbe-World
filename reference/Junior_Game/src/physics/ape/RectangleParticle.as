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
- review getProjection() for precomputing. radius can definitely be precomputed/stored
*/



import physics.ape.*;

/**
 * A rectangular shaped particle. 
 */ 
class physics.ape.RectangleParticle extends AbstractParticle {

	private var _extents:Array;
	private var _axes:Array;
	private var _radian:Number;
	
	
	/**
	 * @param x The initial x position.
	 * @param y The initial y position.
	 * @param width The width of this particle.
	 * @param height The height of this particle.
	 * @param rotation The rotation of this particle in radians.
	 * @param fixed Determines if the particle is fixed or not. Fixed particles
	 * are not affected by forces or collisions and are good to use as surfaces.
	 * Non-fixed particles move freely in response to collision and forces.
	 * @param mass The mass of the particle
	 * @param elasticity The elasticity of the particle. Higher values mean more elasticity.
	 * @param friction The surface friction of the particle. 
	 * <p>
	 * Note that RectangleParticles can be fixed but still have their rotation property 
	 * changed.
	 * </p>
	 */
	function RectangleParticle  (
			x:Number, 
			y:Number, 
			width:Number, 
			height:Number, 
			rotation:Number, 
			fixed:Boolean ,
			mass:Number, 
			elasticity:Number,
			friction:Number) {
		
		
		super(x, y, fixed, mass, elasticity, friction);
		
		
		var rotate:Number;
		
		(rotation == undefined) ? (rotate= 0) : (rotate = rotation);
		(mass == undefined) ? (this.mass = 1) : (this.mass = mass);
		(elasticity == undefined) ? (this.elasticity = 0.3) : (this.elasticity = elasticity);
		(friction == undefined) ? (this.friction = 0) : (this.friction = friction);
		
		_extents = new Array(width, height);
		_axes = new Array(new Vector(0,0), new Vector(0,0));
		radian = rotate;
		
		type = "RectangleParticle";
		
	}
	
	
	/**
	 * The rotation of the RectangleParticle in radians. For drawing methods you may 
	 * want to use the <code>angle</code> property which gives the rotation in
	 * degrees from 0 to 360.
	 * 
	 * <p>
	 * Note that while the RectangleParticle can be rotated, it does not have angular
	 * velocity. In otherwords, during collisions, the rotation is not altered, 
	 * and the energy of the rotation is not applied to other colliding particles.
	 * </p>
	 */
	public function get radian():Number {
		return _radian;
	}
	
	
	/**
	 * @private
	 */		
	public function set radian(t:Number):Void {
		_radian = t;
		setAxes(t);
	}
		
	
	/**
	 * The rotation of the RectangleParticle in degrees. 
	 */
	public function get angle():Number {
		return radian * MathUtil.ONE_EIGHTY_OVER_PI;
	}


	/**
	 * @private
	 */		
	public function set angle(a:Number):Void {
		radian = a * MathUtil.PI_OVER_ONE_EIGHTY;
	}
		
	
	/**
	 * Sets up the visual representation of this RectangleParticle. This method is called 
	 * automatically when an instance of this RectangleParticle's parent Group is added to 
	 * the APEngine, when  this RectangleParticle's Composite is added to a Group, or the 
	 * RectangleParticle is added to a Composite or Group.
	 */				
	public function init():Void {
		cleanup();
		if (displayObject != undefined) {
			initDisplay();
		} //else {
		
			var w:Number = extents[0] * 2;
			var h:Number = extents[1] * 2;
			
			sprite.clear();
			sprite.lineStyle(lineThickness, lineColor, lineAlpha);
			sprite.beginFill(fillColor, fillAlpha);
			drawRect(sprite, -w/2, -h/2, w, h);
			sprite.endFill();
		//}
		paint(0);
	}
	
	
	/**
	 * The default painting method for this particle. This method is called automatically
	 * by the <code>APEngine.paint()</code> method. If you want to define your own custom painting
	 * method, then create a subclass of this class and override <code>paint()</code>.
	 */	
/*	public function paint():Void {
		trace ("i ("+sprite._name+") am at " + curr.x + "," + curr.y);
		sprite._x = curr.x;
		sprite._y = curr.y;
		sprite._rotation = angle;
	}*/
	public function paint( screenOffsetX : Number ):Void {
		sprite._x = curr.x - screenOffsetX;
		sprite._y = curr.y;
		sprite._rotation = angle;
		
		//df - have to move display object to place of particle
		if (displayObject != undefined) {
			displayObject._x = sprite._x + displayObjectOffset.x;
			displayObject._y = sprite._y + displayObjectOffset.y;
			displayObject._rotation = sprite._rotation + displayObjectRotation;
			
		}		
	}
	
	//df - hack
	//public function getSprite() : MovieClip {
	//	return sprite;	
	//}
	
	public function drawRect (mc, x, y, width, height):Void {
		mc.moveTo(x,y);
		 mc.lineTo(x, y+height);
		 mc.lineTo(x+width, y+height);
		 mc.lineTo(x+width, y);
		 mc.lineTo(x, y);
		 mc.moveTo(-5,-5);
		 mc.lineTo(5,5);
		 mc.moveTo(5,-5);
		 mc.lineTo(-5,5);
		 
	}
	
	
	
	
	public function set width(w:Number):Void {
		_extents[0] = w/2;
	}

	
	public function get width():Number {
		return _extents[0] * 2
	}


	public function set height(h:Number):Void {
		_extents[1] = h / 2;
	}


	public function get height():Number {
		return _extents[1] * 2
	}
			
	
	/**
	 * @private
	 */	
	public function get axes():Array {
		return _axes;
	}
	

	/**
	 * @private
	 */	
	public function get extents():Array {
		return _extents;
	}
	
	
	/**
	 * @private
	 */	
	public function getProjection(axis:Vector):Interval {
		
		var radius:Number =
			 extents[0] * Math.abs(axis.dot(axes[0]))+
			 extents[1] * Math.abs(axis.dot(axes[1]));
		
		var c:Number = samp.dot(axis);
		
		interval.min = c - radius;
		interval.max = c + radius;
		return interval;
	}


	/**
	 * 
	 */					
	private function setAxes(t:Number):Void {
		var s:Number = Math.sin(t);
		var c:Number = Math.cos(t);
		
		axes[0].x = c;
		axes[0].y = s;
		axes[1].x = -s;
		axes[1].y = c;
	}
}