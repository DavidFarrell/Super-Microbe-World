
/**
 * @author David
 */
class ebug.ClipLoader extends MovieClipLoader {
	public var totalLoaded : Number; 
	
	function ClipLoader () {
		super();	
		this.addListener(this);
		totalLoaded = 0;
	}
	
	function onLoadInit(_mc:MovieClip) : Void {
	   // this gets done when the jpg is completely loaded:
	   _mc._visible = true;
	   _mc.upper.gotoAndPlay("hurt");
	}
	
	function onLoadProgress(_mc:MovieClip, loaded:Number) : Void {
	   //trace("progress: " + loadedsofar);
		totalLoaded += loaded;
	}

	function onLoadError (targetMC, errorCode) : Void 	{
		trace ("ERRORCODE:" + errorCode);
		trace (targetMC + "Failed to load its content");
	}
	//function 
		
}
