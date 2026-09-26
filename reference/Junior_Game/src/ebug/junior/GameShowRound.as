
class ebug.junior.GameShowRound {
	public var roundId : Number;
	
	public var introText : Array;
	public var name : String;
	public var questions : Array;
	public var isBlind : Boolean; // each round is both blind and not blind - switch this to change the quiz behaviour
	public var questionIndex : Number;
	public var nextRoundFile : String;
	
	public static var BLIND : Number = 0;
	public static var NOT_BLIND : Number = 1;
	
	function GameShowRound() {
		roundId = 0;
		introText = new Array();
		name = "";
		questions = new Array();
		questionIndex = 0;
		isBlind = true;
		nextRoundFile = "";
	}
}