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
- getProjection() needs review for any possibility of precomputing
*/

import physics.ape.*;


/**	
 * A circle shaped particle. 	 
 */
class physics.ape.CircleParticle extends AbstractParticle {

	private var _radius:Number;
	private var _ape:APEngine;
	
	
	/**
	 * @param x The initial x position of this particle.
	 * @param y The initial y position of this particle.
	 * @param radius The radius of this particle.
	 * @param fixed Determines if the particle is fixed or not. Fixed particles
	 * are not affected by forces or collisions and are good to use as surfaces.
	 * Non-fixed particles move freely in response to collision and forces.
	 * @param mass The mass of the particle.
	 * @param elasticity The elasticity of the particle. Higher values mean more elasticity or 'bounciness'.
	 * @param friction The surface friction of the particle.
	 */
	function CircleParticle (
			x:Number, 
			y:Number, 
			radius:Number, 
			fixed:Boolean,
			mass:Number, 
			elasticity:Number,
			friction:Number) {
		
		super(x, y, fixed, mass, elasticity, friction);
		
		(fixed == undefined) ? (this.fixed = false) : (this.fixed = fixed);
		(mass == undefined) ? (this.mass = 1) : (this.mass = mass);
		(elasticity == undefined) ? (this.elasticity = 0.3) : (this.elasticity = elasticity);
		(friction == undefined) ? (this.friction = 0) : (this.friction = friction);
								
		_radius = radius;
		
		type = "CircleParticle";
		
		
	}

	/**
	 * The radius of the particle.
	 */
	public function get radius():Number {
		return _radius;
	}		
	
	
	/**
	 * @private
	 */
	public function set radius(r:Number):Void {
		_radius = r;
	}
	
	
	/**
	 * Sets up the visual representation of this CircleParticle. This method is called 
	 * automatically when an instance of this CircleParticle's parent Group is added to 
	 * the APEngine, when  this CircleParticle's Composite is added to a Group, or the 
	 * CircleParticle is added to a Composite or Group.
	 */		
	public  function init(apeEngine:APEngine):Void {
	
		_ape = apeEngine;
	
		cleanup();
		if (displayObject != undefined) {
			initDisplay();
		} else {
			sprite.clear();
			var lineThickness = 1;
			var lineColor = 0x000000
			var lineAlpha = 100;
			sprite.lineStyle(lineThickness, lineColor, lineAlpha);
			sprite.beginFill(fillColor, fillAlpha);
			drawCircle(sprite, 0, 0, radius);
			sprite.endFill();
		}
		paint(0);
	}
	
	
	/**
	 * The default painting method for this particle. This method is called automatically
	 * by the <code>APEngine.paint()</code> method. If you want to define your own custom painting
	 * method, then create a subclass of this class and override <code>paint()</code>.
	 */			
	public  function paint( screenOffsetX : Number ):Void {
		sprite._x = curr.x - screenOffsetX ;
		sprite._y = curr.y;	
	}
	
	
	/**
	 * @private
	 */
	 
	 
	 
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
	 
	 
	 
	 
	 
	 
	public function getProjection(axis:Vector):Interval {
		var c:Number = samp.dot(axis);
		interval.min = c - _radius;
		interval.max = c + _radius;
		
		return interval;
	}
	
	
	/**
	 * @private
	 */
	public function getIntervalX():Interval {
		interval.min = curr.x - _radius;
		interval.max = curr.x + _radius;
		return interval;
	}
	
	
	/**
	 * @private
	 */		
	public function getIntervalY():Interval {
		interval.min = curr.y - _radius;
		interval.max = curr.y + _radius;
		return interval;
	}
}

