/**
 * @author sbbc231
 */
import ebug.*;
class ebug.EBugStrings {
	public var locale:Number;
	
	public static var LOCALE_ENGLISH = 0;
	
	public static var GIRL_NAME = 9;
	public static var BOY_NAME = 10;
	 
	public static var EBUG_STRINGS_PARAM = "EBUGPARAM";
	 
	public function EBugStrings() {
		this.locale = EBugStrings.LOCALE_ENGLISH;
	}
	
	public static function insertParams(sourceString:String, params:Array):String {
		var returnString;
		for (var i = 0; i < params.length; i++) {
			var location:Number = sourceString.indexOf(EBugStrings.EBUG_STRINGS_PARAM);
			returnString = sourceString.substr(0, location) + params[i] + sourceString.substr(location + EBugStrings.EBUG_STRINGS_PARAM.length);;
			return returnString;  
 		}	
	}

	public function getString(index:Number):String {
		switch (locale) {
			default:
				switch (index) {
					case 0:
						return "Welcome to the e-Bug Game Show!<br>The show where you get points by learning about microbes.";
						break;
					case 1:
						return "I don't think you've played before... hmm.";
						break;
					case 2:
						return "Which of you is playing first?";
						break;
					case 3:
						return "something else";
						break;
					case 4:
						return "a) ( choose the girl )";
						break;
					case 5:
						return "b) ( choose the boy )";
						break;
					case 6:
						return "Allright ";
						break;
					case 7:
						return ", let's get this show on the road!";
						break;
					case 8:
						return "<b>What's your name then?</b>";
						break;
					case 9:
						return "Amy";
						break;
					case 10:
						return "Harry";
						break;
					case 11:
						return "Excellent!";
						break;
					case 12:
						return "OK, can you spell that for me please?";
						break;
					case 13:
						return " correct?";
						break;
					case 14:
						return "a) Yes";
						break;
					case 15:
						return "b) No";
						break;
					case 16:
						return "";
						break;
					case 17:
						return "";
						break;
					case 18:
						return "";
						break;
					case 19:
						return "";
						break;
					case 20:
						return "";
						break;
					case 21:
						return "";
						break;
					case 22:
						return "";
						break;
					case 23:
						return "";
						break;
					case 24:
						return "";
						break;
					case 25:
						return "";
						break;
					case 26:
						return "";
						break;
					case 27:
						return "";
						break;
					case 28:
						return "";
						break;
					case 29:
						return "";
						break;
					case 30:
						return "";
						break;
					case 31:
						return "";
						break;
					case 32:
						return "";
						break;
					case 33:
						return "";
						break;
					case 34:
						return "";
						break;
					case 35:
						return "";
						break;
					case 36:
						return "";
						break;
					case 37:
						return "";
						break;
					case 38:
						return "";
						break;
					case 39:
						return "";
						break;
					case 40:
						return "";
						break;
					case 41:
						return "";
						break;
					case 42:
						return "";
						break;
					case 43:
						return "";
						break;
					case 44:
						return "";
						break;
					case 45:
						return "";
						break;
					case 46:
						return "";
						break;
					case 47:
						return "";
						break;
					case 48:
						return "";
						break;
					case 49:
						return "";
						break;
					case 50:
						return "";
						break;
					case 51:
						return "";
						break;
					case 52:
						return "";
						break;
					case 53:
						return "";
						break;
					case 54:
						return "";
						break;
					case 55:
						return "";
						break;
					case 56:
						return "";
						break;
					case 57:
						return "";
						break;
					case 58:
						return "";
						break;
					case 59:
						return "";
						break;
					case 60:
						return "";
						break;
					case 61:
						return "";
						break;
					case 62:
						return "";
						break;
					case 63:
						return "";
						break;
					case 64:
						return "";
						break;
					case 65:
						return "";
						break;
					case 66:
						return "";
						break;
					case 67:
						return "";
						break;
					case 68:
						return "";
						break;
					case 69:
						return "";
						break;
					case 70:
						return "";
						break;
					case 71:
						return "";
						break;
					case 72:
						return "";
						break;
					case 73:
						return "";
						break;
					case 74:
						return "";
						break;
					case 75:
						return "";
						break;
					case 76:
						return "";
						break;
					case 77:
						return "";
						break;
					case 78:
						return "";
						break;
					case 79:
						return "";
						break;
					case 80:
						return "";
						break;
					case 81:
						return "";
						break;
					case 82:
						return "";
						break;
					case 83:
						return "";
						break;
					case 84:
						return "";
						break;
					case 85:
						return "";
						break;
					case 86:
						return "";
						break;
					case 87:
						return "";
						break;
					case 88:
						return "";
						break;
					case 89:
						return "";
						break;
					case 90:
						return "";
						break;
					case 91:
						return "";
						break;
					case 92:
						return "";
						break;
					case 93:
						return "";
						break;
					case 94:
						return "";
						break;
					case 95:
						return "";
						break;
					case 96:
						return "";
						break;
					case 97:
						return "";
						break;
					case 98:
						return "";
						break;
					case 99:
						return "";
						break;						
					default:
						return "String not found for index: "+index;
						break;	
				}
				break;
		}
		
		
	}
	
	
	
	
}