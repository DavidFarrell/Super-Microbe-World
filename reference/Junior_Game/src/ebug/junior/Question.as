/*
 * Question
 */

 class ebug.junior.Question {
	public static var QUESTION_TYPE_YND : Number = 0;
	
	public static var ANSWER_WRONG : Number = -1;
	public static var ANSWER_DUNNO : Number = 0;
	public static var ANSWER_CORRECT : Number = 1;
	 
	public var questionId : Number; 	// universal unique identifier for the question
	public var questionType : Number; 	// multiple choice?  Free text?  Likert?
	public var score : Number; 			// in game value of the answer
	public var value : Number;			// the 'research' value of the answer
	public var questionText : String; 	// text to show user
	public var answers : Array; 		// structure changes on answer type - usually [id][text][value]
	 
	function Question() {
		questionId = 0;
		questionType = 0;
		score = 0;
		questionText = "";
		answers = new Array();
	}
	
	public function toString() : String {
		return "Question " + questionId + ": \""+questionText+"\"";
	}
 }