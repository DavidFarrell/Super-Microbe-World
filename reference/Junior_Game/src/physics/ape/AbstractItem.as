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
*/


import physics.ape.*;

/** 
 * The base class for all constraints and particles
 */
class physics.ape.AbstractItem {
	
	private var _sprite:MovieClip;
	private var _visible:Boolean;
	private var _alwaysRepaint:Boolean;
	

	/** @private */
	private /* was internal */ var lineThickness:Number;
	/** @private */
	private /* was internal */ var lineColor:Number;
	/** @private */
	private /* was internal */ var lineAlpha:Number;
	/** @private */
	private /* was internal */ var fillColor:Number;
	/** @private */
	private /* was internal */ var fillAlpha:Number;
	/** @private */
	private /* was internal */ var displayObject:MovieClip;
	/** @private */
	private /* was internal */ var displayObjectOffset:Vector;
	/** @private */
	private /* was internal */ var displayObjectRotation:Number;
	
	
	function AbstractItem() {
		_visible = true;	
		_alwaysRepaint = false;
	}
	
	
	/**
	 * This method is automatically called when an item's parent group is added to the engine,
	 * an item's Composite is added to a Group, or the item is added to a Composite or Group.
	 */
	public function init():Void {}
	
			
	/**
	 * The default painting method for this item. This method is called automatically
	 * by the <code>APEngine.paint()</code> method. 
	 */			
	public function paint(screenOffsetX):Void {}	
	
	
	/**
	 * This method is called automatically when an item's parent group is removed
	 * from the APEngine.
	 */
	public function cleanup():Void {
		sprite.clear();
		for (var i:Number = 0; i < sprite.numChildren; i++) {
			sprite.removeMovieClip();
		}
		// in AS2, this is not a property of a MC, so this is a manually-created property we have to reset
		sprite.numChildren = 0;
	}
	
	
	/**
	 * For performance, fixed Particles and SpringConstraints don't have their <code>paint()</code>
	 * method called in order to aVoid unnecessary redrawing. A SpringConstraint is considered
	 * fixed if its two connecting Particles are fixed. Setting this property to <code>true</code>
	 * forces <code>paint()</code> to be called if this Particle or SpringConstraint <code>fixed</code>
	 * property is true. If you are rotating a fixed Particle or SpringConstraint then you would set 
	 * it's repaintFixed property to true. This property has no effect if a Particle or 
	 * SpringConstraint is not fixed.
	 */
	public  function get alwaysRepaint():Boolean {
		return _alwaysRepaint;
	}
	
	
	/**
	 * @private
	 */
	public  function set alwaysRepaint(b:Boolean):Void {
		_alwaysRepaint = b;
	}	
	
			
	/**
	 * The visibility of the item. 
	 */	
	public function get visible():Boolean {
		return _visible;
	}
	
	
	/**
	 * @private
	 */			
	public function set visible(v:Boolean):Void {
		_visible = v;
		sprite._visible = v;
	}


	/**
	 * Sets the line and fill of this Item.
	 */ 		
	public function setStyle(
			lineThickness:Number, lineColor:Number, lineAlpha:Number,
			fillColor:Number, fillAlpha:Number):Void {
		
		var line_thickness:Number;
		var line_color:Number;
		var line_alpha:Number;
		var fill_color:Number;
		var fill_alpha:Number;
		
		(lineThickness == undefined) ? (line_thickness = 0) : (line_thickness = lineThickness);
		(lineColor == undefined) ? (line_color = 0x000000) : ( line_color = lineColor);
		(lineAlpha == undefined) ? (line_alpha = 100) : (line_alpha = lineAlpha);
		(fillColor == undefined) ? (fill_color = 0xffffff) : (fill_color = fillColor);
		(fillAlpha == undefined) ? (fill_alpha = 100) : (fill_alpha = fillAlpha);
		
		setLine(line_thickness, line_color, line_alpha);		
		setFill(fill_color, fill_alpha);		
	}		
	
	
	/**
	 * Sets the style of the line for this Item. 
	 */ 
	public function setLine(thickness:Number, color:Number, alpha:Number):Void {
	
		var thick:Number;
		var c:Number;
		var a:Number;
		
		(thickness == undefined) ? (thick = 0) : (thick = thickness);
		(color == undefined) ? (c = 0x000000) : (c = color);
		(alpha == undefined) ? (a = 100) : (a = alpha);
	
		lineThickness = thick;
		lineColor = c;
		lineAlpha = a;
	}
		
		
	/**
	 * Sets the style of the fill for this Item. 
	 */ 
	public function setFill(color:Number, alpha:Number):Void {
	
		var c:Number;
		var a:Number;
		(color == undefined) ? (c = 0x000000) : (c = color);
		(alpha == undefined) ? (a = 100) : (a = alpha);
	
		fillColor = c;
		fillAlpha = a;
	}
	
	
	/**
	 * Provides a Sprite to use as a container for drawing or adding children. When the
	 * sprite is requested for the first time it is automatically added to the global
	 * container in the APEngine class.
	 */	
	public function get sprite():MovieClip {
		if (_sprite != undefined) return _sprite;
		
		if (APEngine.container == undefined) {
			throw new Error("The container property of the APEngine class has not been set (AI.as) ("+ sprite._name+")");
		} else {
			var base = APEngine.container;
		}
		
		var spriteName:String = "sprite" + base.numChildren++ +"_mc";
		_sprite = base.createEmptyMovieClip(spriteName, base.getNextHighestDepth());
		_sprite.numChildren = 0;
		
		//trace(_sprite + " is created");
		return _sprite;
	}	
}
