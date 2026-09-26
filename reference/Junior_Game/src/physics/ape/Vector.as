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
- provide passible vectors for results. too much object creation happening here
- review the division by zero checks/corrections. why are they needed?
*/


class physics.ape.Vector {
	
	public var x:Number;
	public var y:Number;


	function Vector(px:Number, py:Number) {
		
		var p_x:Number;
		var p_y:Number;
		(px == undefined) ? (p_x = 0) : (p_x = px);
		(py == undefined) ? (p_y = 0) : (p_y = py);
		x = p_x;
		y = p_y;
	}
	
	
	public function setTo(px:Number, py:Number):Void {
		x = px;
		y = py;
	}
	
	
	public function copy(v:Vector):Void {
		x = v.x;
		y = v.y;
	}


	public function dot(v:Vector):Number {
		return x * v.x + y * v.y;
	}
	
	
	public function cross(v:Vector):Number {
		return x * v.y - y * v.x;
	}
	

	public function plus(v:Vector):Vector {
		return new Vector(x + v.x, y + v.y); 
	}

	
	public function plusEquals(v:Vector):Vector {
		x += v.x;
		y += v.y;
		return this;
	}
	
	
	public function minus(v:Vector):Vector {
		return new Vector(x - v.x, y - v.y);    
	}


	public function minusEquals(v:Vector):Vector {
		x -= v.x;
		y -= v.y;
		return this;
	}


	public function mult(s:Number):Vector {
		return new Vector(x * s, y * s);
	}


	public function multEquals(s:Number):Vector {
		x *= s;
		y *= s;
		return this;
	}


	public function times(v:Vector):Vector {
		return new Vector(x * v.x, y * v.y);
	}
	
	
	public function divEquals(s:Number):Vector {
		if (s == 0) s = 0.0001;
		x /= s;
		y /= s;
		return this;
	}
	
	
	public function magnitude():Number {
		return Math.sqrt(x * x + y * y);
	}

	
	public function distance(v:Vector):Number {
		var delta:Vector = this.minus(v);
		return delta.magnitude();
	}


	public function normalize():Vector {
		 var m:Number = magnitude();
		 if (m == 0) m = 0.0001;
		 return mult(1 / m);
	}
	
			
	public function toString():String {
		return (x + " : " + y);
	}
}