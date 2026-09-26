import ebug.Entity;
import ebug.junior.*;
/**
 * @author sbbc231
 */
class ebug.junior.Goal {
	
	public var goalType : Number;
	public var required : Number;
	public var microbeType : Number;
	public var goalId : Number;
	
	public var achieved : Number;
	
	public static var PHOTOGRAPH_SPECIFIC : Number = 0;
	public static var PHOTOGRAPH_GOOD : Number = 1;
	public static var PHOTOGRAPH_BAD : Number = 2;
	public static var PHOTOGRAPH_ANY : Number = 3;
	public static var KILL_ALL : Number = 4;
	public static var KILL_SPECIFIC : Number = 5;
	public static var ANTIBIOTIC : Number = 6;
	public static var YOGURT : Number = 7;
	
	public static var TICK : Boolean = true;
	public static var CROSS : Boolean = false;
	
	function Goal (inType : Number, inMicrobeType : Number, inRequired : Number)  {
		goalType = inType;
		microbeType = inMicrobeType;
		required = inRequired;
		achieved = 0;
		goalId = 0;
	}
	
	function isGoalMet() : Boolean {
		if ( achieved == required ){
			return true; 
		} else {
			return false; 
		}	
	}
	
	function updateGoal(event : Event) : Array {
		var events : Array = new Array();
		trace("update goal type: " + goalType + " with event type: " + event.type);
		if ( event.type == Event.BE_PHOTOGRAPHED ) {
			switch ( goalType ) {
				case PHOTOGRAPH_SPECIFIC :
					if ( event.target.type == microbeType ) {
						achieved ++;
						if ( isGoalMet() ) {
							trace ("made specific photo goal");	
						}
						
						var params : Array = new Array();
						params[0] = goalId;
						params[1] = Goal.TICK;
						var updateStatusEvent : Event = new Event(Event.MODIFY_GOAL_STATUS, null, params);
						events.push(updateStatusEvent);
					} else trace ("photo but not correct bug ("+microbeType+"): got instead " +event.target.type);
					break;
				case PHOTOGRAPH_GOOD :
				trace("goodie");
					if ( event.target instanceof GoodMicrobe ) {
						achieved ++;
						if ( isGoalMet() ) {
							trace ("made good photo goal");	
						}
						
						var params : Array = new Array();
						params[0] = goalId;
						params[1] = Goal.TICK;
						//var updateStatusEvent : Event = new Event(Event.MODIFY_GOAL_STATUS, null, params);
						events = new Array();
						events.push( new Event( Event.MODIFY_GOAL_STATUS, null, params) );
						//events.push(new Event(Event.IDLE, this, params));
					}
					break;
				case PHOTOGRAPH_ANY :
					achieved ++;
					if ( isGoalMet() ) {
						trace ("made any photo goal");	
					}
						
					var params : Array = new Array();
					params[0] = goalId;
					params[1] = Goal.TICK;
					var updateStatusEvent : Event = new Event(Event.MODIFY_GOAL_STATUS, null, params);
					events.push(updateStatusEvent);
					break;
				default:
					trace("unknown photo goal: [" + goalType + "] and goodie should be ["+PHOTOGRAPH_GOOD+"] --["+(PHOTOGRAPH_GOOD == goalType)+"]");
					break;
			}	
		} else if ( event.type == Event.BE_KILLED ) {
			trace ("Someone died");
			switch ( goalType ) {
				case Goal.KILL_ALL :
					if ( event.target instanceof BadMicrobe ) {
						achieved ++;
						if ( isGoalMet() ) {
							trace ("made a good kill goal");	
						}
						trace ("bang bang");
						var params : Array = new Array();
						params[0] = goalId;
						params[1] = Goal.TICK;
						var updateStatusEvent : Event = new Event(Event.MODIFY_GOAL_STATUS, null, params);
						events.push(updateStatusEvent);
					} else {
						trace ("bad kill " + typeof event.target);
					}
					break;
				case PHOTOGRAPH_GOOD :
					if ( event.target instanceof GoodMicrobe ) {
						achieved ++;
						if ( isGoalMet() ) {
							trace ("made good photo goal");	
						}
						
						var params : Array = new Array();
						params[0] = goalId;
						params[1] = Goal.TICK;
						var updateStatusEvent : Event = new Event(Event.MODIFY_GOAL_STATUS, null, params);
						events.push(updateStatusEvent);
					}
					break;
				case KILL_ALL :
					achieved ++;
					if ( isGoalMet() ) {
						trace ("made kill all goal");	
					}
						
					var params : Array = new Array();
					params[0] = goalId;
					params[1] = Goal.TICK;
					var updateStatusEvent : Event = new Event(Event.MODIFY_GOAL_STATUS, null, params);
					events.push(updateStatusEvent);
					break;
			}	
		} else if ( event.type == Event.MILK_GLASS_EVENT_TURN_TO_YOGURT ) {
			if ( goalType == Goal.YOGURT ) {
				achieved ++;
				if ( isGoalMet() ) {
					trace ("made yogurt goal");
				}
				var params : Array = new Array();
				params[0] = goalId;
				params[1] = Goal.TICK;
				var updateStatusEvent : Event = new Event ( Event.MODIFY_GOAL_STATUS, null, params);
				events.push(updateStatusEvent);
			}
		} else if ( event.type == Event.EXPLODE_ANTIBIOTIC ) {
			if ( goalType == Goal.ANTIBIOTIC ) {
				achieved ++;
				if ( isGoalMet() ) {
					trace ("met antibiotic usage goal");
				}
				var params : Array = new Array();
				params[0] = goalId;
				params[1] = Goal.TICK;
				var updateStatusEvent : Event = new Event ( Event.MODIFY_GOAL_STATUS, null, params);
				events.push(updateStatusEvent);
			} 
		} else trace (" goal event not recognised: " + event.type);
		
		return events;
	}
	
}
