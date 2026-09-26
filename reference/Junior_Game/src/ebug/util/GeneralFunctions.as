class ebug.util.GeneralFunctions {
	
		static function getRandom(min:Number, max:Number) : Number {   
			return Math.round( Math.random() * (max - min)) + min; 
		}
	
}