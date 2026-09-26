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

import physics.ape.*;


/**
 * The abstract base class for all constraints. 
 * 
 * <p>
 * You should not instantiate this class directly -- instead use one of the subclasses.
 * </p>
 */
class physics.ape.AbstractConstraint extends AbstractItem {
	
	private var _stiffness:Number;
	

	/** 
	 * @private
	 */
	function AbstractConstraint (stiffness:Number) {	
		/* AS3 only
		if (getQualifiedClassName(this) == "org.cove.ape::AbstractConstraint") {
			throw new ArgumentError("AbstractConstraint can't be instantiated directly");
		}
		*/
		this.stiffness = stiffness;
		setStyle();
	}
		
	
	/**
	 * The stiffness of the constraint. Higher values result in result in 
	 * stiffer constraints. Values should be > 0 and <= 1. Depending on the situation, 
	 * setting constraints to very high values may result in instability.
	 */ 
	public function get stiffness():Number {
		return _stiffness;
	}
	
	
	/**
	 * @private
	 */			
	public function set stiffness(s:Number):Void {
		_stiffness = s;
	}
	
	
	/**
	 * @private
	 */					
	public function resolve():Void {}
}