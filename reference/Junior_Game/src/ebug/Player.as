
/**
 * @author sbbc231
 */
class ebug.Player {
	public var forename : String;
	public var surname : String;
	public var nickname : String;
	public var age : Number;
	public var sex : Boolean;
	public var avatarSex : Boolean;
	public var nationality : Number;
	public var language : Number;
	public var id : Number;
	public var email : String;
	
	// these may move elsewhere
	public var playerAnswers : Array;
	public var score : Number;
	
	public static var MALE : Boolean = true;
	public static var FEMALE : Boolean = false;

	/*function Player() {
		
	}*/
	
	function Player(inForename : String, inSurname : String, inNickname : String, inAge : Number,  inSex : Boolean, 
	inAvatarSex : Boolean, inNationality : Number, inLanguage : Number,inId : Number, inEmail : String) {
		forename = (inForename == null) ? ((inSex) ? "Harry" : "Amy") : inForename;
		surname = (inSurname == null) ? "Smith" : inSurname;
		nickname = (inNickname == null) ? forename : inNickname;
		age = (isNaN(inAge)) ? 100 : inAge;
		sex = (inSex == true)?true:false;
		avatarSex = inAvatarSex;
		nationality = inNationality;
		language = inLanguage;
		id = (isNaN(inId)) ? 0 : inId;
		email = inEmail;
		playerAnswers = new Array();
		score = 0;
	}
}
