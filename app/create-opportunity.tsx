import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
  FlatList,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, ChevronDown, Eye, ImagePlus, Bookmark, CheckCircle2, Instagram, Youtube } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sbInsert } from "@/integrations/supabase/client";
import { useProfile } from "@/contexts/ProfileContext";

const NEED_TYPES = [
  "Photographer",
  "Model",
  "Videographer",
  "Content Creator",
  "Stylist",
  "Designer",
  "Creative Director",
  "Clothing Brand",
  "Agency",
  "Publisher",
  "Photography Business",
  "Other",
];

const US_CITIES = [
  { city: "Manhattan", state: "NY" },
  { city: "Brooklyn", state: "NY" },
  { city: "Queens", state: "NY" },
  { city: "The Bronx", state: "NY" },
  { city: "Staten Island", state: "NY" },
  { city: "Albany", state: "NY" },
  { city: "Rochester", state: "NY" },
  { city: "Yonkers", state: "NY" },
  { city: "Syracuse", state: "NY" },
  { city: "Buffalo", state: "NY" },
  { city: "New Rochelle", state: "NY" },
  { city: "Mount Vernon", state: "NY" },
  { city: "Schenectady", state: "NY" },
  { city: "Utica", state: "NY" },
  { city: "White Plains", state: "NY" },
  { city: "Troy", state: "NY" },
  { city: "Niagara Falls", state: "NY" },
  { city: "Binghamton", state: "NY" },
  { city: "Freeport", state: "NY" },
  { city: "Valley Stream", state: "NY" },
  { city: "Long Beach", state: "NY" },
  { city: "Hempstead", state: "NY" },
  { city: "North Hempstead", state: "NY" },
  { city: "Oyster Bay", state: "NY" },
  { city: "Poughkeepsie", state: "NY" },
  { city: "West Seneca", state: "NY" },
  { city: "Tonawanda", state: "NY" },
  { city: "Cheektowaga", state: "NY" },
  { city: "Amherst", state: "NY" },
  { city: "Irondequoit", state: "NY" },
  { city: "New City", state: "NY" },
  { city: "West Babylon", state: "NY" },
  { city: "Levittown", state: "NY" },
  { city: "Harrison", state: "NY" },
  { city: "Jamestown", state: "NY" },
  { city: "Rome", state: "NY" },
  { city: "Elmira", state: "NY" },
  { city: "Kingston", state: "NY" },
  { city: "Middletown", state: "NY" },
  { city: "Port Chester", state: "NY" },
  { city: "Ossining", state: "NY" },
  { city: "Saratoga Springs", state: "NY" },
  { city: "Newburgh", state: "NY" },
  { city: "Ithaca", state: "NY" },
  { city: "Watertown", state: "NY" },
  { city: "Spring Valley", state: "NY" },
  { city: "Westbury", state: "NY" },
  { city: "Rockville Centre", state: "NY" },
  { city: "Glen Cove", state: "NY" },
  { city: "Massapequa", state: "NY" },
  { city: "Lindenhurst", state: "NY" },
  { city: "East Meadow", state: "NY" },
  { city: "Oceanside", state: "NY" },
  { city: "Hicksville", state: "NY" },
  { city: "Plainview", state: "NY" },
  { city: "Bethpage", state: "NY" },
  { city: "Farmingdale", state: "NY" },
  { city: "Coram", state: "NY" },
  { city: "Commack", state: "NY" },
  { city: "Huntington Station", state: "NY" },
  { city: "Huntington", state: "NY" },
  { city: "Smithtown", state: "NY" },
  { city: "Centereach", state: "NY" },
  { city: "Selden", state: "NY" },
  { city: "Medford", state: "NY" },
  { city: "Brentwood", state: "NY" },
  { city: "Central Islip", state: "NY" },
  { city: "Bay Shore", state: "NY" },
  { city: "West Islip", state: "NY" },
  { city: "Deer Park", state: "NY" },
  { city: "North Babylon", state: "NY" },
  { city: "Copiague", state: "NY" },
  { city: "Ronkonkoma", state: "NY" },
  { city: "Lake Ronkonkoma", state: "NY" },
  { city: "Holbrook", state: "NY" },
  { city: "Bohemia", state: "NY" },
  { city: "Islip", state: "NY" },
  { city: "Patchogue", state: "NY" },
  { city: "Shirley", state: "NY" },
  { city: "Mastic", state: "NY" },
  { city: "Mastic Beach", state: "NY" },
  { city: "Riverhead", state: "NY" },
  { city: "Port Jefferson Station", state: "NY" },
  { city: "Port Jefferson", state: "NY" },
  { city: "East Setauket", state: "NY" },
  { city: "Setauket", state: "NY" },
  { city: "Stony Brook", state: "NY" },
  { city: "Hauppauge", state: "NY" },
  { city: "Nesconset", state: "NY" },
  { city: "Lake Grove", state: "NY" },
  { city: "East Northport", state: "NY" },
  { city: "Northport", state: "NY" },
  { city: "Kings Park", state: "NY" },
  { city: "Elwood", state: "NY" },
  { city: "Greenlawn", state: "NY" },
  { city: "East Islip", state: "NY" },
  { city: "Sayville", state: "NY" },
  { city: "Babylon", state: "NY" },
  { city: "Amityville", state: "NY" },
  { city: "Massapequa Park", state: "NY" },
  { city: "Seaford", state: "NY" },
  { city: "Wantagh", state: "NY" },
  { city: "Bellmore", state: "NY" },
  { city: "Merrick", state: "NY" },
  { city: "East Rockaway", state: "NY" },
  { city: "Lynbrook", state: "NY" },
  { city: "Malverne", state: "NY" },
  { city: "Garden City", state: "NY" },
  { city: "Mineola", state: "NY" },
  { city: "Carle Place", state: "NY" },
  { city: "Old Westbury", state: "NY" },
  { city: "Jericho", state: "NY" },
  { city: "Syosset", state: "NY" },
  { city: "Woodbury", state: "NY" },
  { city: "Roslyn", state: "NY" },
  { city: "Roslyn Heights", state: "NY" },
  { city: "Manhasset", state: "NY" },
  { city: "Great Neck", state: "NY" },
  { city: "Port Washington", state: "NY" },
  { city: "New Hyde Park", state: "NY" },
  { city: "Floral Park", state: "NY" },
  { city: "Franklin Square", state: "NY" },
  { city: "Elmont", state: "NY" },
  { city: "Baldwin", state: "NY" },
  { city: "Roosevelt", state: "NY" },
  { city: "Uniondale", state: "NY" },
  { city: "East Meadow", state: "NY" },
  { city: "Scarsdale", state: "NY" },
  { city: "Mamaroneck", state: "NY" },
  { city: "Larchmont", state: "NY" },
  { city: "Rye", state: "NY" },
  { city: "Pelham", state: "NY" },
  { city: "Bronxville", state: "NY" },
  { city: "Tuckahoe", state: "NY" },
  { city: "Eastchester", state: "NY" },
  { city: "Dobbs Ferry", state: "NY" },
  { city: "Ardsley", state: "NY" },
  { city: "Irvington", state: "NY" },
  { city: "Tarrytown", state: "NY" },
  { city: "Sleepy Hollow", state: "NY" },
  { city: "Briarcliff Manor", state: "NY" },
  { city: "Pleasantville", state: "NY" },
  { city: "Mount Kisco", state: "NY" },
  { city: "Yorktown Heights", state: "NY" },
  { city: "Peekskill", state: "NY" },
  { city: "Cortlandt Manor", state: "NY" },
  { city: "Croton-on-Hudson", state: "NY" },
  { city: "Mohegan Lake", state: "NY" },
  { city: "Somers", state: "NY" },
  { city: "Katonah", state: "NY" },
  { city: "Bedford", state: "NY" },
  { city: "Mount Pleasant", state: "NY" },
  { city: "Chappaqua", state: "NY" },
  { city: "Hawthorne", state: "NY" },
  { city: "Valhalla", state: "NY" },
  { city: "Elmsford", state: "NY" },
  { city: "Greenburgh", state: "NY" },
  { city: "Hartsdale", state: "NY" },
  { city: "Hastings-on-Hudson", state: "NY" },
  { city: "Nanuet", state: "NY" },
  { city: "Pearl River", state: "NY" },
  { city: "Orangeburg", state: "NY" },
  { city: "Nyack", state: "NY" },
  { city: "West Nyack", state: "NY" },
  { city: "Valley Cottage", state: "NY" },
  { city: "Garnerville", state: "NY" },
  { city: "Haverstraw", state: "NY" },
  { city: "Stony Point", state: "NY" },
  { city: "Thiells", state: "NY" },
  { city: "Pomona", state: "NY" },
  { city: "Sloatsburg", state: "NY" },
  { city: "Suffern", state: "NY" },
  { city: "Monsey", state: "NY" },
  { city: "Airmont", state: "NY" },
  { city: "Chestnut Ridge", state: "NY" },
  { city: "Wesley Hills", state: "NY" },
  { city: "Kaser", state: "NY" },
  { city: "New Square", state: "NY" },
  { city: "Montebello", state: "NY" },
  { city: "Hillburn", state: "NY" },
  { city: "Monroe", state: "NY" },
  { city: "Kiryas Joel", state: "NY" },
  { city: "Warwick", state: "NY" },
  { city: "Chester", state: "NY" },
  { city: "Goshen", state: "NY" },
  { city: "Middletown", state: "NY" },
  { city: "Port Jervis", state: "NY" },
  { city: "Beacon", state: "NY" },
  { city: "Fishkill", state: "NY" },
  { city: "Wappingers Falls", state: "NY" },
  { city: "Hopewell Junction", state: "NY" },
  { city: "LaGrangeville", state: "NY" },
  { city: "Pleasant Valley", state: "NY" },
  { city: "Hyde Park", state: "NY" },
  { city: "Rhinebeck", state: "NY" },
  { city: "Red Hook", state: "NY" },
  { city: "Tivoli", state: "NY" },
  { city: "Saugerties", state: "NY" },
  { city: "Woodstock", state: "NY" },
  { city: "Catskill", state: "NY" },
  { city: "Hudson", state: "NY" },
  { city: "Coxsackie", state: "NY" },
  { city: "Athens", state: "NY" },
  { city: "Glens Falls", state: "NY" },
  { city: "Queensbury", state: "NY" },
  { city: "Lake George", state: "NY" },
  { city: "Warrensburg", state: "NY" },
  { city: "Plattsburgh", state: "NY" },
  { city: "Malone", state: "NY" },
  { city: "Massena", state: "NY" },
  { city: "Potsdam", state: "NY" },
  { city: "Canton", state: "NY" },
  { city: "Ogdensburg", state: "NY" },
  { city: "Oswego", state: "NY" },
  { city: "Fulton", state: "NY" },
  { city: "Auburn", state: "NY" },
  { city: "Cortland", state: "NY" },
  { city: "Norwich", state: "NY" },
  { city: "Oneonta", state: "NY" },
  { city: "Cooperstown", state: "NY" },
  { city: "Amsterdam", state: "NY" },
  { city: "Gloversville", state: "NY" },
  { city: "Johnstown", state: "NY" },
  { city: "Cohoes", state: "NY" },
  { city: "Watervliet", state: "NY" },
  { city: "Rensselaer", state: "NY" },
  { city: "Latham", state: "NY" },
  { city: "Clifton Park", state: "NY" },
  { city: "Colonie", state: "NY" },
  { city: "Guilderland", state: "NY" },
  { city: "Delmar", state: "NY" },
  { city: "Bethlehem", state: "NY" },
  { city: "Ravena", state: "NY" },
  { city: "Valatie", state: "NY" },
  { city: "Kinderhook", state: "NY" },
  { city: "Chatham", state: "NY" },
  { city: "Canandaigua", state: "NY" },
  { city: "Geneva", state: "NY" },
  { city: "Newark", state: "NY" },
  { city: "Palmyra", state: "NY" },
  { city: "Victor", state: "NY" },
  { city: "Fairport", state: "NY" },
  { city: "Pittsford", state: "NY" },
  { city: "Brighton", state: "NY" },
  { city: "Henrietta", state: "NY" },
  { city: "Penfield", state: "NY" },
  { city: "Webster", state: "NY" },
  { city: "Greece", state: "NY" },
  { city: "Brockport", state: "NY" },
  { city: "Spencerport", state: "NY" },
  { city: "Hilton", state: "NY" },
  { city: "Batavia", state: "NY" },
  { city: "Le Roy", state: "NY" },
  { city: "Geneseo", state: "NY" },
  { city: "Dansville", state: "NY" },
  { city: "Hornell", state: "NY" },
  { city: "Wellsville", state: "NY" },
  { city: "Olean", state: "NY" },
  { city: "Salamanca", state: "NY" },
  { city: "Dunkirk", state: "NY" },
  { city: "Fredonia", state: "NY" },
  { city: "Lockport", state: "NY" },
  { city: "North Tonawanda", state: "NY" },
  { city: "Kenmore", state: "NY" },
  { city: "Lancaster", state: "NY" },
  { city: "Depew", state: "NY" },
  { city: "Hamburg", state: "NY" },
  { city: "Orchard Park", state: "NY" },
  { city: "East Aurora", state: "NY" },
  { city: "Williamsville", state: "NY" },
  { city: "Clarence", state: "NY" },
  { city: "Akron", state: "NY" },
  { city: "Lewiston", state: "NY" },
  { city: "Grand Island", state: "NY" },
  { city: "Bridgeport", state: "CT" },
  { city: "Stamford", state: "CT" },
  { city: "New Haven", state: "CT" },
  { city: "Hartford", state: "CT" },
  { city: "Waterbury", state: "CT" },
  { city: "Norwalk", state: "CT" },
  { city: "Danbury", state: "CT" },
  { city: "New Britain", state: "CT" },
  { city: "West Hartford", state: "CT" },
  { city: "Greenwich", state: "CT" },
  { city: "Hamden", state: "CT" },
  { city: "Meriden", state: "CT" },
  { city: "Bristol", state: "CT" },
  { city: "West Haven", state: "CT" },
  { city: "Milford", state: "CT" },
  { city: "Stratford", state: "CT" },
  { city: "East Hartford", state: "CT" },
  { city: "Middletown", state: "CT" },
  { city: "Wallingford", state: "CT" },
  { city: "Norwich", state: "CT" },
  { city: "Shelton", state: "CT" },
  { city: "Torrington", state: "CT" },
  { city: "Trumbull", state: "CT" },
  { city: "Glastonbury", state: "CT" },
  { city: "Newington", state: "CT" },
  { city: "New London", state: "CT" },
  { city: "Westport", state: "CT" },
  { city: "Fairfield", state: "CT" },
  { city: "Ridgefield", state: "CT" },
  { city: "Manchester", state: "CT" },
  { city: "Vernon", state: "CT" },
  { city: "Southington", state: "CT" },
  { city: "Groton", state: "CT" },
  { city: "Windsor", state: "CT" },
  { city: "Enfield", state: "CT" },
  { city: "Naugatuck", state: "CT" },
  { city: "Branford", state: "CT" },
  { city: "Wethersfield", state: "CT" },
  { city: "Darien", state: "CT" },
  { city: "Newtown", state: "CT" },
  { city: "Cheshire", state: "CT" },
  { city: "Wilton", state: "CT" },
  { city: "Bethel", state: "CT" },
  { city: "Rocky Hill", state: "CT" },
  { city: "Plainville", state: "CT" },
  { city: "North Haven", state: "CT" },
  { city: "Simsbury", state: "CT" },
  { city: "Ansonia", state: "CT" },
  { city: "East Haven", state: "CT" },
  { city: "Guilford", state: "CT" },
  { city: "Killingly", state: "CT" },
  { city: "Bloomfield", state: "CT" },
  { city: "Derby", state: "CT" },
  { city: "Berlin", state: "CT" },
  { city: "Avon", state: "CT" },
  { city: "Stonington", state: "CT" },
  { city: "New Milford", state: "CT" },
  { city: "Cromwell", state: "CT" },
  { city: "Montville", state: "CT" },
  { city: "Seymour", state: "CT" },
  { city: "Watertown", state: "CT" },
  { city: "Wolcott", state: "CT" },
  { city: "Windsor Locks", state: "CT" },
  { city: "Canton", state: "CT" },
  { city: "Boston", state: "MA" },
  { city: "Worcester", state: "MA" },
  { city: "Springfield", state: "MA" },
  { city: "Cambridge", state: "MA" },
  { city: "Lowell", state: "MA" },
  { city: "Brockton", state: "MA" },
  { city: "New Bedford", state: "MA" },
  { city: "Quincy", state: "MA" },
  { city: "Lynn", state: "MA" },
  { city: "Fall River", state: "MA" },
  { city: "Newton", state: "MA" },
  { city: "Somerville", state: "MA" },
  { city: "Lawrence", state: "MA" },
  { city: "Framingham", state: "MA" },
  { city: "Haverhill", state: "MA" },
  { city: "Waltham", state: "MA" },
  { city: "Malden", state: "MA" },
  { city: "Brookline", state: "MA" },
  { city: "Plymouth", state: "MA" },
  { city: "Medford", state: "MA" },
  { city: "Taunton", state: "MA" },
  { city: "Chicopee", state: "MA" },
  { city: "Weymouth", state: "MA" },
  { city: "Revere", state: "MA" },
  { city: "Peabody", state: "MA" },
  { city: "Methuen", state: "MA" },
  { city: "Barnstable", state: "MA" },
  { city: "Pittsfield", state: "MA" },
  { city: "Attleboro", state: "MA" },
  { city: "Everett", state: "MA" },
  { city: "Salem", state: "MA" },
  { city: "Westfield", state: "MA" },
  { city: "Leominster", state: "MA" },
  { city: "Fitchburg", state: "MA" },
  { city: "Beverly", state: "MA" },
  { city: "Holyoke", state: "MA" },
  { city: "Marlborough", state: "MA" },
  { city: "Woburn", state: "MA" },
  { city: "Chelsea", state: "MA" },
  { city: "Amherst", state: "MA" },
  { city: "Braintree", state: "MA" },
  { city: "Shrewsbury", state: "MA" },
  { city: "Randolph", state: "MA" },
  { city: "Billerica", state: "MA" },
  { city: "Arlington", state: "MA" },
  { city: "Watertown", state: "MA" },
  { city: "Franklin", state: "MA" },
  { city: "Needham", state: "MA" },
  { city: "Northampton", state: "MA" },
  { city: "Wellesley", state: "MA" },
  { city: "Agawam", state: "MA" },
  { city: "Natick", state: "MA" },
  { city: "West Springfield", state: "MA" },
  { city: "Dartmouth", state: "MA" },
  { city: "Gloucester", state: "MA" },
  { city: "Chelmsford", state: "MA" },
  { city: "Andover", state: "MA" },
  { city: "Lexington", state: "MA" },
  { city: "Norwood", state: "MA" },
  { city: "Concord", state: "MA" },
  { city: "Wakefield", state: "MA" },
  { city: "Dedham", state: "MA" },
  { city: "Milton", state: "MA" },
  { city: "Belmont", state: "MA" },
  { city: "Stoneham", state: "MA" },
  { city: "Melrose", state: "MA" },
  { city: "Winchester", state: "MA" },
  { city: "Reading", state: "MA" },
  { city: "Burlington", state: "MA" },
  { city: "Saugus", state: "MA" },
  { city: "Canton", state: "MA" },
  { city: "Danvers", state: "MA" },
  { city: "Marblehead", state: "MA" },
  { city: "Easton", state: "MA" },
  { city: "North Andover", state: "MA" },
  { city: "Bridgewater", state: "MA" },
  { city: "Acton", state: "MA" },
  { city: "Westwood", state: "MA" },
  { city: "Sudbury", state: "MA" },
  { city: "Swampscott", state: "MA" },
  { city: "Stoughton", state: "MA" },
  { city: "Dracut", state: "MA" },
  { city: "Wilmington", state: "MA" },
  { city: "Lynnfield", state: "MA" },
  { city: "Wayland", state: "MA" },
  { city: "Hingham", state: "MA" },
  { city: "Tewksbury", state: "MA" },
  { city: "Norwood", state: "MA" },
  { city: "Scituate", state: "MA" },
  { city: "Newburyport", state: "MA" },
  { city: "Longmeadow", state: "MA" },
  { city: "Hanover", state: "MA" },
  { city: "Mansfield", state: "MA" },
  { city: "Holden", state: "MA" },
  { city: "Los Angeles", state: "CA" },
  { city: "Chicago", state: "IL" },
  { city: "Houston", state: "TX" },
  { city: "Phoenix", state: "AZ" },
  { city: "Philadelphia", state: "PA" },
  { city: "San Antonio", state: "TX" },
  { city: "San Diego", state: "CA" },
  { city: "Dallas", state: "TX" },
  { city: "San Jose", state: "CA" },
  { city: "Austin", state: "TX" },
  { city: "Jacksonville", state: "FL" },
  { city: "Fort Worth", state: "TX" },
  { city: "Columbus", state: "OH" },
  { city: "Charlotte", state: "NC" },
  { city: "San Francisco", state: "CA" },
  { city: "Indianapolis", state: "IN" },
  { city: "Seattle", state: "WA" },
  { city: "Denver", state: "CO" },
  { city: "Boston", state: "MA" },
  { city: "Nashville", state: "TN" },
  { city: "Detroit", state: "MI" },
  { city: "Portland", state: "OR" },
  { city: "Las Vegas", state: "NV" },
  { city: "Memphis", state: "TN" },
  { city: "Baltimore", state: "MD" },
  { city: "Milwaukee", state: "WI" },
  { city: "Albuquerque", state: "NM" },
  { city: "Tucson", state: "AZ" },
  { city: "Fresno", state: "CA" },
  { city: "Mesa", state: "AZ" },
  { city: "Sacramento", state: "CA" },
  { city: "Atlanta", state: "GA" },
  { city: "Kansas City", state: "MO" },
  { city: "Colorado Springs", state: "CO" },
  { city: "Raleigh", state: "NC" },
  { city: "Miami", state: "FL" },
  { city: "Long Beach", state: "CA" },
  { city: "Virginia Beach", state: "VA" },
  { city: "Oakland", state: "CA" },
  { city: "Minneapolis", state: "MN" },
  { city: "Tampa", state: "FL" },
  { city: "Tulsa", state: "OK" },
  { city: "Arlington", state: "TX" },
  { city: "New Orleans", state: "LA" },
  { city: "Wichita", state: "KS" },
  { city: "Cleveland", state: "OH" },
  { city: "Bakersfield", state: "CA" },
  { city: "Aurora", state: "CO" },
  { city: "Anaheim", state: "CA" },
  { city: "Honolulu", state: "HI" },
  { city: "Santa Ana", state: "CA" },
  { city: "Riverside", state: "CA" },
  { city: "Corpus Christi", state: "TX" },
  { city: "Lexington", state: "KY" },
  { city: "Henderson", state: "NV" },
  { city: "Stockton", state: "CA" },
  { city: "Saint Paul", state: "MN" },
  { city: "Cincinnati", state: "OH" },
  { city: "St. Louis", state: "MO" },
  { city: "Pittsburgh", state: "PA" },
  { city: "Greensboro", state: "NC" },
  { city: "Lincoln", state: "NE" },
  { city: "Anchorage", state: "AK" },
  { city: "Plano", state: "TX" },
  { city: "Orlando", state: "FL" },
  { city: "Irvine", state: "CA" },
  { city: "Newark", state: "NJ" },
  { city: "Durham", state: "NC" },
  { city: "Chula Vista", state: "CA" },
  { city: "Toledo", state: "OH" },
  { city: "Fort Wayne", state: "IN" },
  { city: "St. Petersburg", state: "FL" },
  { city: "Laredo", state: "TX" },
  { city: "Jersey City", state: "NJ" },
  { city: "Chandler", state: "AZ" },
  { city: "Madison", state: "WI" },
  { city: "Lubbock", state: "TX" },
  { city: "Scottsdale", state: "AZ" },
  { city: "Reno", state: "NV" },
  { city: "Gilbert", state: "AZ" },
  { city: "Glendale", state: "AZ" },
  { city: "North Las Vegas", state: "NV" },
  { city: "Winston-Salem", state: "NC" },
  { city: "Chesapeake", state: "VA" },
  { city: "Norfolk", state: "VA" },
  { city: "Fremont", state: "CA" },
  { city: "Garland", state: "TX" },
  { city: "Irving", state: "TX" },
  { city: "Hialeah", state: "FL" },
  { city: "Richmond", state: "VA" },
  { city: "Boise", state: "ID" },
  { city: "Spokane", state: "WA" },
  { city: "Birmingham", state: "AL" },
  { city: "Montgomery", state: "AL" },
  { city: "Mobile", state: "AL" },
  { city: "Huntsville", state: "AL" },
  { city: "Fairbanks", state: "AK" },
  { city: "Juneau", state: "AK" },
  { city: "Little Rock", state: "AR" },
  { city: "Fayetteville", state: "AR" },
  { city: "Fort Smith", state: "AR" },
  { city: "San Bernardino", state: "CA" },
  { city: "Modesto", state: "CA" },
  { city: "Oxnard", state: "CA" },
  { city: "Fontana", state: "CA" },
  { city: "Moreno Valley", state: "CA" },
  { city: "Glendale", state: "CA" },
  { city: "Huntington Beach", state: "CA" },
  { city: "Santa Clarita", state: "CA" },
  { city: "Garden Grove", state: "CA" },
  { city: "Oceanside", state: "CA" },
  { city: "Rancho Cucamonga", state: "CA" },
  { city: "Ontario", state: "CA" },
  { city: "Lancaster", state: "CA" },
  { city: "Elk Grove", state: "CA" },
  { city: "Corona", state: "CA" },
  { city: "Palmdale", state: "CA" },
  { city: "Salinas", state: "CA" },
  { city: "Pomona", state: "CA" },
  { city: "Hayward", state: "CA" },
  { city: "Sunnyvale", state: "CA" },
  { city: "Pasadena", state: "CA" },
  { city: "Lakewood", state: "CO" },
  { city: "Thornton", state: "CO" },
  { city: "Arvada", state: "CO" },
  { city: "Westminster", state: "CO" },
  { city: "Pueblo", state: "CO" },
  { city: "Centennial", state: "CO" },
  { city: "Boulder", state: "CO" },
  { city: "Bridgeport", state: "CT" },
  { city: "New Haven", state: "CT" },
  { city: "Stamford", state: "CT" },
  { city: "Hartford", state: "CT" },
  { city: "Waterbury", state: "CT" },
  { city: "Norwalk", state: "CT" },
  { city: "Danbury", state: "CT" },
  { city: "Wilmington", state: "DE" },
  { city: "Dover", state: "DE" },
  { city: "Newark", state: "DE" },
  { city: "Tallahassee", state: "FL" },
  { city: "Fort Lauderdale", state: "FL" },
  { city: "Port St. Lucie", state: "FL" },
  { city: "Cape Coral", state: "FL" },
  { city: "Pembroke Pines", state: "FL" },
  { city: "Hollywood", state: "FL" },
  { city: "Miramar", state: "FL" },
  { city: "Coral Springs", state: "FL" },
  { city: "Clearwater", state: "FL" },
  { city: "West Palm Beach", state: "FL" },
  { city: "Lakeland", state: "FL" },
  { city: "Pompano Beach", state: "FL" },
  { city: "Savannah", state: "GA" },
  { city: "Athens", state: "GA" },
  { city: "Sandy Springs", state: "GA" },
  { city: "Roswell", state: "GA" },
  { city: "Macon", state: "GA" },
  { city: "Johns Creek", state: "GA" },
  { city: "Albany", state: "GA" },
  { city: "Warner Robins", state: "GA" },
  { city: "Hilo", state: "HI" },
  { city: "Kailua", state: "HI" },
  { city: "Kapolei", state: "HI" },
  { city: "Cedar Rapids", state: "IA" },
  { city: "Davenport", state: "IA" },
  { city: "Sioux City", state: "IA" },
  { city: "Iowa City", state: "IA" },
  { city: "Des Moines", state: "IA" },
  { city: "Waterloo", state: "IA" },
  { city: "Nampa", state: "ID" },
  { city: "Meridian", state: "ID" },
  { city: "Idaho Falls", state: "ID" },
  { city: "Pocatello", state: "ID" },
  { city: "Caldwell", state: "ID" },
  { city: "Coeur d'Alene", state: "ID" },
  { city: "Naperville", state: "IL" },
  { city: "Aurora", state: "IL" },
  { city: "Rockford", state: "IL" },
  { city: "Joliet", state: "IL" },
  { city: "Springfield", state: "IL" },
  { city: "Elgin", state: "IL" },
  { city: "Peoria", state: "IL" },
  { city: "Champaign", state: "IL" },
  { city: "Bloomington", state: "IL" },
  { city: "Evansville", state: "IN" },
  { city: "South Bend", state: "IN" },
  { city: "Carmel", state: "IN" },
  { city: "Fishers", state: "IN" },
  { city: "Bloomington", state: "IN" },
  { city: "Hammond", state: "IN" },
  { city: "Gary", state: "IN" },
  { city: "Overland Park", state: "KS" },
  { city: "Olathe", state: "KS" },
  { city: "Topeka", state: "KS" },
  { city: "Lawrence", state: "KS" },
  { city: "Shawnee", state: "KS" },
  { city: "Manhattan", state: "KS" },
  { city: "Louisville", state: "KY" },
  { city: "Bowling Green", state: "KY" },
  { city: "Owensboro", state: "KY" },
  { city: "Covington", state: "KY" },
  { city: "Baton Rouge", state: "LA" },
  { city: "Shreveport", state: "LA" },
  { city: "Lafayette", state: "LA" },
  { city: "Lake Charles", state: "LA" },
  { city: "Kenner", state: "LA" },
  { city: "Bossier City", state: "LA" },
  { city: "Monroe", state: "LA" },
  { city: "Worcester", state: "MA" },
  { city: "Springfield", state: "MA" },
  { city: "Cambridge", state: "MA" },
  { city: "Lowell", state: "MA" },
  { city: "Brockton", state: "MA" },
  { city: "New Bedford", state: "MA" },
  { city: "Quincy", state: "MA" },
  { city: "Lynn", state: "MA" },
  { city: "Newton", state: "MA" },
  { city: "Somerville", state: "MA" },
  { city: "Lawrence", state: "MA" },
  { city: "Annapolis", state: "MD" },
  { city: "Frederick", state: "MD" },
  { city: "Rockville", state: "MD" },
  { city: "Gaithersburg", state: "MD" },
  { city: "Bowie", state: "MD" },
  { city: "Hagerstown", state: "MD" },
  { city: "Portland", state: "ME" },
  { city: "Lewiston", state: "ME" },
  { city: "Bangor", state: "ME" },
  { city: "South Portland", state: "ME" },
  { city: "Auburn", state: "ME" },
  { city: "Grand Rapids", state: "MI" },
  { city: "Warren", state: "MI" },
  { city: "Sterling Heights", state: "MI" },
  { city: "Ann Arbor", state: "MI" },
  { city: "Lansing", state: "MI" },
  { city: "Flint", state: "MI" },
  { city: "Dearborn", state: "MI" },
  { city: "Livonia", state: "MI" },
  { city: "St. Paul", state: "MN" },
  { city: "Rochester", state: "MN" },
  { city: "Duluth", state: "MN" },
  { city: "Bloomington", state: "MN" },
  { city: "Brooklyn Park", state: "MN" },
  { city: "Plymouth", state: "MN" },
  { city: "Springfield", state: "MO" },
  { city: "Independence", state: "MO" },
  { city: "Columbia", state: "MO" },
  { city: "Lee's Summit", state: "MO" },
  { city: "O'Fallon", state: "MO" },
  { city: "Jackson", state: "MS" },
  { city: "Gulfport", state: "MS" },
  { city: "Southaven", state: "MS" },
  { city: "Hattiesburg", state: "MS" },
  { city: "Biloxi", state: "MS" },
  { city: "Meridian", state: "MS" },
  { city: "Billings", state: "MT" },
  { city: "Missoula", state: "MT" },
  { city: "Great Falls", state: "MT" },
  { city: "Bozeman", state: "MT" },
  { city: "Butte", state: "MT" },
  { city: "Helena", state: "MT" },
  { city: "Charlotte", state: "NC" },
  { city: "Wilmington", state: "NC" },
  { city: "Cary", state: "NC" },
  { city: "High Point", state: "NC" },
  { city: "Concord", state: "NC" },
  { city: "Asheville", state: "NC" },
  { city: "Fargo", state: "ND" },
  { city: "Bismarck", state: "ND" },
  { city: "Grand Forks", state: "ND" },
  { city: "Minot", state: "ND" },
  { city: "West Fargo", state: "ND" },
  { city: "Omaha", state: "NE" },
  { city: "Bellevue", state: "NE" },
  { city: "Grand Island", state: "NE" },
  { city: "Kearney", state: "NE" },
  { city: "Fremont", state: "NE" },
  { city: "Manchester", state: "NH" },
  { city: "Nashua", state: "NH" },
  { city: "Concord", state: "NH" },
  { city: "Derry", state: "NH" },
  { city: "Rochester", state: "NH" },
  { city: "Salem", state: "NH" },
  { city: "Trenton", state: "NJ" },
  { city: "Paterson", state: "NJ" },
  { city: "Elizabeth", state: "NJ" },
  { city: "Edison", state: "NJ" },
  { city: "Woodbridge", state: "NJ" },
  { city: "Lakewood", state: "NJ" },
  { city: "Toms River", state: "NJ" },
  { city: "Hamilton", state: "NJ" },
  { city: "Clifton", state: "NJ" },
  { city: "Camden", state: "NJ" },
  { city: "Passaic", state: "NJ" },
  { city: "Union City", state: "NJ" },
  { city: "Bayonne", state: "NJ" },
  { city: "East Orange", state: "NJ" },
  { city: "Vineland", state: "NJ" },
  { city: "New Brunswick", state: "NJ" },
  { city: "Hoboken", state: "NJ" },
  { city: "Perth Amboy", state: "NJ" },
  { city: "West New York", state: "NJ" },
  { city: "Plainfield", state: "NJ" },
  { city: "Hackensack", state: "NJ" },
  { city: "Sayreville", state: "NJ" },
  { city: "Kearny", state: "NJ" },
  { city: "Linden", state: "NJ" },
  { city: "Atlantic City", state: "NJ" },
  { city: "Fort Lee", state: "NJ" },
  { city: "Fair Lawn", state: "NJ" },
  { city: "Long Branch", state: "NJ" },
  { city: "Bloomfield", state: "NJ" },
  { city: "Cherry Hill", state: "NJ" },
  { city: "Parsippany-Troy Hills", state: "NJ" },
  { city: "Old Bridge", state: "NJ" },
  { city: "Middletown", state: "NJ" },
  { city: "North Bergen", state: "NJ" },
  { city: "Gloucester City", state: "NJ" },
  { city: "Montclair", state: "NJ" },
  { city: "Brick Township", state: "NJ" },
  { city: "Piscataway", state: "NJ" },
  { city: "Marlboro", state: "NJ" },
  { city: "Wayne", state: "NJ" },
  { city: "Irvington", state: "NJ" },
  { city: "Pennsauken", state: "NJ" },
  { city: "Paramus", state: "NJ" },
  { city: "Ridgewood", state: "NJ" },
  { city: "West Orange", state: "NJ" },
  { city: "Willingboro", state: "NJ" },
  { city: "Bridgewater", state: "NJ" },
  { city: "Ewing", state: "NJ" },
  { city: "Englewood", state: "NJ" },
  { city: "Hillside", state: "NJ" },
  { city: "Rahway", state: "NJ" },
  { city: "Jackson", state: "NJ" },
  { city: "Westfield", state: "NJ" },
  { city: "Bergenfield", state: "NJ" },
  { city: "Princeton", state: "NJ" },
  { city: "Teaneck", state: "NJ" },
  { city: "Nutley", state: "NJ" },
  { city: "Garfield", state: "NJ" },
  { city: "Dover", state: "NJ" },
  { city: "Livingston", state: "NJ" },
  { city: "Maplewood", state: "NJ" },
  { city: "Millville", state: "NJ" },
  { city: "Carteret", state: "NJ" },
  { city: "Westwood", state: "NJ" },
  { city: "South Orange", state: "NJ" },
  { city: "Cliffside Park", state: "NJ" },
  { city: "Cranford", state: "NJ" },
  { city: "Rutherford", state: "NJ" },
  { city: "Morristown", state: "NJ" },
  { city: "Pleasantville", state: "NJ" },
  { city: "Roselle", state: "NJ" },
  { city: "Flemington", state: "NJ" },
  { city: "Somerville", state: "NJ" },
  { city: "Ocean City", state: "NJ" },
  { city: "Mahwah", state: "NJ" },
  { city: "Burlington", state: "NJ" },
  { city: "Belleville", state: "NJ" },
  { city: "Summit", state: "NJ" },
  { city: "Madison", state: "NJ" },
  { city: "Howell", state: "NJ" },
  { city: "Dumont", state: "NJ" },
  { city: "Secaucus", state: "NJ" },
  { city: "Lyndhurst", state: "NJ" },
  { city: "Clark", state: "NJ" },
  { city: "Metuchen", state: "NJ" },
  { city: "Collingswood", state: "NJ" },
  { city: "Red Bank", state: "NJ" },
  { city: "Manville", state: "NJ" },
  { city: "Barnegat", state: "NJ" },
  { city: "Monroe Township", state: "NJ" },
  { city: "Mount Laurel", state: "NJ" },
  { city: "Evesham", state: "NJ" },
  { city: "Voorhees", state: "NJ" },
  { city: "Egg Harbor Township", state: "NJ" },
  { city: "Franklin Township", state: "NJ" },
  { city: "Gloucester Township", state: "NJ" },
  { city: "Santa Fe", state: "NM" },
  { city: "Las Cruces", state: "NM" },
  { city: "Rio Rancho", state: "NM" },
  { city: "Roswell", state: "NM" },
  { city: "Farmington", state: "NM" },
  { city: "Carson City", state: "NV" },
  { city: "Sparks", state: "NV" },

  { city: "Akron", state: "OH" },
  { city: "Dayton", state: "OH" },
  { city: "Canton", state: "OH" },
  { city: "Youngstown", state: "OH" },
  { city: "Parma", state: "OH" },
  { city: "Oklahoma City", state: "OK" },
  { city: "Norman", state: "OK" },
  { city: "Broken Arrow", state: "OK" },
  { city: "Lawton", state: "OK" },
  { city: "Edmond", state: "OK" },
  { city: "Eugene", state: "OR" },
  { city: "Salem", state: "OR" },
  { city: "Gresham", state: "OR" },
  { city: "Hillsboro", state: "OR" },
  { city: "Beaverton", state: "OR" },
  { city: "Bend", state: "OR" },
  { city: "Medford", state: "OR" },
  { city: "Erie", state: "PA" },
  { city: "Allentown", state: "PA" },
  { city: "Reading", state: "PA" },
  { city: "Scranton", state: "PA" },
  { city: "Bethlehem", state: "PA" },
  { city: "Lancaster", state: "PA" },
  { city: "Harrisburg", state: "PA" },
  { city: "York", state: "PA" },
  { city: "Williamsport", state: "PA" },
  { city: "Wilkes-Barre", state: "PA" },
  { city: "Chester", state: "PA" },
  { city: "Norristown", state: "PA" },
  { city: "State College", state: "PA" },
  { city: "Hazleton", state: "PA" },
  { city: "Lebanon", state: "PA" },
  { city: "Johnstown", state: "PA" },
  { city: "Monroeville", state: "PA" },
  { city: "Plum", state: "PA" },
  { city: "McKeesport", state: "PA" },
  { city: "West Chester", state: "PA" },
  { city: "Easton", state: "PA" },
  { city: "Hermitage", state: "PA" },
  { city: "Lower Merion", state: "PA" },
  { city: "Bristol", state: "PA" },
  { city: "Kingston", state: "PA" },
  { city: "Wilkinsburg", state: "PA" },
  { city: "Altoona", state: "PA" },
  { city: "Carlisle", state: "PA" },
  { city: "Washington", state: "PA" },
  { city: "Chambersburg", state: "PA" },
  { city: "Pottstown", state: "PA" },
  { city: "West Mifflin", state: "PA" },
  { city: "Coatesville", state: "PA" },
  { city: "Butler", state: "PA" },
  { city: "Phoenixville", state: "PA" },
  { city: "King of Prussia", state: "PA" },
  { city: "Drexel Hill", state: "PA" },
  { city: "Lansdowne", state: "PA" },
  { city: "Haverford", state: "PA" },
  { city: "Bensalem", state: "PA" },
  { city: "Levittown", state: "PA" },
  { city: "Sharon", state: "PA" },
  { city: "New Castle", state: "PA" },
  { city: "Greensburg", state: "PA" },
  { city: "Bethel Park", state: "PA" },
  { city: "Willow Grove", state: "PA" },
  { city: "Radnor", state: "PA" },
  { city: "Upper Darby", state: "PA" },
  { city: "Abington", state: "PA" },
  { city: "Cheltenham", state: "PA" },
  { city: "Lower Southampton", state: "PA" },
  { city: "Whitehall", state: "PA" },
  { city: "Mount Lebanon", state: "PA" },
  { city: "Ross Township", state: "PA" },
  { city: "Cranberry Township", state: "PA" },
  { city: "Hempfield", state: "PA" },
  { city: "Penn Hills", state: "PA" },
  { city: "Shaler Township", state: "PA" },
  { city: "Baldwin", state: "PA" },
  { city: "Millcreek", state: "PA" },
  { city: "Hanover", state: "PA" },
  { city: "Gettysburg", state: "PA" },
  { city: "Indiana", state: "PA" },
  { city: "Meadville", state: "PA" },
  { city: "Uniontown", state: "PA" },
  { city: "Lower Paxton", state: "PA" },
  { city: "Derry Township", state: "PA" },
  { city: "Muhlenberg", state: "PA" },
  { city: "Hampden Township", state: "PA" },
  { city: "Upper Merion", state: "PA" },
  { city: "Middletown", state: "PA" },
  { city: "Warminster", state: "PA" },
  { city: "Northampton Township", state: "PA" },
  { city: "Upper Moreland", state: "PA" },
  { city: "Pottsville", state: "PA" },
  { city: "Bloomsburg", state: "PA" },
  { city: "Lower Makefield", state: "PA" },
  { city: "McCandless", state: "PA" },
  { city: "Spring Garden", state: "PA" },
  { city: "Ridley Township", state: "PA" },
  { city: "Springfield", state: "PA" },
  { city: "Haverford Township", state: "PA" },
  { city: "Providence", state: "RI" },
  { city: "Warwick", state: "RI" },
  { city: "Cranston", state: "RI" },
  { city: "Pawtucket", state: "RI" },
  { city: "East Providence", state: "RI" },
  { city: "Woonsocket", state: "RI" },
  { city: "Coventry", state: "RI" },
  { city: "Cumberland", state: "RI" },
  { city: "North Providence", state: "RI" },
  { city: "South Kingstown", state: "RI" },
  { city: "West Warwick", state: "RI" },
  { city: "Johnston", state: "RI" },
  { city: "North Kingstown", state: "RI" },
  { city: "Newport", state: "RI" },
  { city: "Bristol", state: "RI" },
  { city: "Westerly", state: "RI" },
  { city: "Smithfield", state: "RI" },
  { city: "Lincoln", state: "RI" },
  { city: "Central Falls", state: "RI" },
  { city: "Portsmouth", state: "RI" },
  { city: "Barrington", state: "RI" },
  { city: "Burrillville", state: "RI" },
  { city: "Middletown", state: "RI" },
  { city: "Narragansett", state: "RI" },
  { city: "Tiverton", state: "RI" },
  { city: "East Greenwich", state: "RI" },
  { city: "North Smithfield", state: "RI" },
  { city: "Warren", state: "RI" },
  { city: "Scituate", state: "RI" },
  { city: "Glocester", state: "RI" },
  { city: "Hopkinton", state: "RI" },
  { city: "Richmond", state: "RI" },
  { city: "Charlestown", state: "RI" },
  { city: "Exeter", state: "RI" },
  { city: "Foster", state: "RI" },
  { city: "West Greenwich", state: "RI" },
  { city: "Jamestown", state: "RI" },
  { city: "Little Compton", state: "RI" },
  { city: "New Shoreham", state: "RI" },
  { city: "Columbia", state: "SC" },
  { city: "Charleston", state: "SC" },
  { city: "North Charleston", state: "SC" },
  { city: "Mount Pleasant", state: "SC" },
  { city: "Rock Hill", state: "SC" },
  { city: "Greenville", state: "SC" },
  { city: "Summerville", state: "SC" },
  { city: "Sioux Falls", state: "SD" },
  { city: "Rapid City", state: "SD" },
  { city: "Aberdeen", state: "SD" },
  { city: "Brookings", state: "SD" },
  { city: "Watertown", state: "SD" },
  { city: "Knoxville", state: "TN" },
  { city: "Chattanooga", state: "TN" },
  { city: "Clarksville", state: "TN" },
  { city: "Murfreesboro", state: "TN" },
  { city: "Franklin", state: "TN" },
  { city: "Jackson", state: "TN" },
  { city: "El Paso", state: "TX" },
  { city: "Amarillo", state: "TX" },
  { city: "Grand Prairie", state: "TX" },
  { city: "Brownsville", state: "TX" },
  { city: "Pasadena", state: "TX" },
  { city: "McKinney", state: "TX" },
  { city: "Mesquite", state: "TX" },
  { city: "McAllen", state: "TX" },
  { city: "Killeen", state: "TX" },
  { city: "Waco", state: "TX" },
  { city: "Carrollton", state: "TX" },
  { city: "Beaumont", state: "TX" },
  { city: "Abilene", state: "TX" },
  { city: "Frisco", state: "TX" },
  { city: "Denton", state: "TX" },
  { city: "Midland", state: "TX" },
  { city: "Wichita Falls", state: "TX" },
  { city: "Odessa", state: "TX" },
  { city: "Round Rock", state: "TX" },
  { city: "Richardson", state: "TX" },
  { city: "Tyler", state: "TX" },
  { city: "Lewisville", state: "TX" },
  { city: "College Station", state: "TX" },
  { city: "Pearland", state: "TX" },
  { city: "Allen", state: "TX" },
  { city: "League City", state: "TX" },
  { city: "Sugar Land", state: "TX" },
  { city: "Salt Lake City", state: "UT" },
  { city: "West Valley City", state: "UT" },
  { city: "Provo", state: "UT" },
  { city: "West Jordan", state: "UT" },
  { city: "Orem", state: "UT" },
  { city: "Sandy", state: "UT" },
  { city: "Ogden", state: "UT" },
  { city: "St. George", state: "UT" },
  { city: "Layton", state: "UT" },
  { city: "Arlington", state: "VA" },
  { city: "Newport News", state: "VA" },
  { city: "Alexandria", state: "VA" },
  { city: "Hampton", state: "VA" },
  { city: "Roanoke", state: "VA" },
  { city: "Portsmouth", state: "VA" },
  { city: "Suffolk", state: "VA" },
  { city: "Lynchburg", state: "VA" },
  { city: "Burlington", state: "VT" },
  { city: "South Burlington", state: "VT" },
  { city: "Rutland", state: "VT" },
  { city: "Barre", state: "VT" },
  { city: "Montpelier", state: "VT" },
  { city: "Tacoma", state: "WA" },
  { city: "Vancouver", state: "WA" },
  { city: "Bellevue", state: "WA" },
  { city: "Kent", state: "WA" },
  { city: "Everett", state: "WA" },
  { city: "Renton", state: "WA" },
  { city: "Yakima", state: "WA" },
  { city: "Federal Way", state: "WA" },
  { city: "Spokane Valley", state: "WA" },
  { city: "Bellingham", state: "WA" },
  { city: "Kennewick", state: "WA" },
  { city: "Madison", state: "WI" },
  { city: "Green Bay", state: "WI" },
  { city: "Kenosha", state: "WI" },
  { city: "Racine", state: "WI" },
  { city: "Appleton", state: "WI" },
  { city: "Waukesha", state: "WI" },
  { city: "Eau Claire", state: "WI" },
  { city: "Oshkosh", state: "WI" },
  { city: "Janesville", state: "WI" },
  { city: "Charleston", state: "WV" },
  { city: "Huntington", state: "WV" },
  { city: "Morgantown", state: "WV" },
  { city: "Parkersburg", state: "WV" },
  { city: "Wheeling", state: "WV" },
  { city: "Cheyenne", state: "WY" },
  { city: "Casper", state: "WY" },
  { city: "Laramie", state: "WY" },
  { city: "Gillette", state: "WY" },
  { city: "Rock Springs", state: "WY" },
];

export default function CreateOpportunityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { currentUserId, resolvedProfile, profile } = useProfile();

  const [title, setTitle] = useState("");
  const [needTypes, setNeedTypes] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [paymentType, setPaymentType] = useState<"paid" | "unpaid" | "">("");
  const [priceMin, setPriceMin] = useState<string>("");
  const [priceMax, setPriceMax] = useState<string>("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [requirements, setRequirements] = useState<string[]>([]);
  const [newRequirement, setNewRequirement] = useState("");
  const [showNeedDropdown, setShowNeedDropdown] = useState(false);
  const [tempSelectedTypes, setTempSelectedTypes] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<{ city: string; state: string; display: string }[]>([]);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [enableNotifications, setEnableNotifications] = useState(true);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!currentUserId) throw new Error("Must be logged in");
      if (!title.trim()) throw new Error("Title is required");
      if (needTypes.length === 0) throw new Error("At least one role type is required");

      let budgetString = "";
      if (paymentType === "unpaid") {
        budgetString = "Unpaid";
      } else if (paymentType === "paid") {
        const parsedMin = priceMin.trim() !== "" ? Number(priceMin.replace(/[^0-9.]/g, "")) : null;
        const parsedMax = priceMax.trim() !== "" ? Number(priceMax.replace(/[^0-9.]/g, "")) : null;
        const parts = [];
        if (parsedMin) parts.push(parsedMin.toLocaleString());
        if (parsedMax) parts.push(parsedMax.toLocaleString());
        budgetString = parts.length > 0 ? `Paid ${parts.join(" - ")}` : "Paid";
      }

      const opportunityData: Record<string, unknown> = {
        title: title.trim(),
        location: location.trim() || null,
        user_id: currentUserId,
        image_url: imageUrl || null,
        description: description.trim() || null,
        budget: budgetString || null,
        company: resolvedProfile.displayName || "Unknown",
      };

      if (needTypes.length > 0) {
        opportunityData.type = needTypes.join(", ");
      }

      if (requirements.length > 0) {
        opportunityData.requirements = requirements;
      }

      console.log("[CreateOpportunity] Inserting:", JSON.stringify(opportunityData, null, 2));
      const result = await sbInsert("opportunities", opportunityData);
      console.log("[CreateOpportunity] Insert result:", result);
      return result;
    },
    onSuccess: async () => {
      console.log("[CreateOpportunity] Success, invalidating all opportunity-related queries");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["opportunities"] }),
        queryClient.invalidateQueries({ queryKey: ["unique-locations"] }),
      ]);
      queryClient.refetchQueries({ queryKey: ["opportunities"] });
      queryClient.refetchQueries({ queryKey: ["unique-locations"] });
      console.log("[CreateOpportunity] Queries invalidated and refetched");
      router.back();
    },
    onError: (error) => {
      console.error("[CreateOpportunity] Error:", error);
      console.error("[CreateOpportunity] Error message:", (error as any)?.message);
      console.error("[CreateOpportunity] Error stack:", (error as any)?.stack);
      const errorMsg = (error as any)?.message || "Unknown error";
      alert(`Failed to create opportunity. ${errorMsg}`);
    },
  });

  const handleAddRequirement = () => {
    if (newRequirement.trim()) {
      setRequirements([...requirements, newRequirement.trim()]);
      setNewRequirement("");
    }
  };

  useEffect(() => {
    if (location.length < 2) {
      setLocationSuggestions([]);
      setShowLocationDropdown(false);
      return;
    }

    const searchLower = location.toLowerCase().trim();
    const matches = US_CITIES.filter((loc) => {
      const cityMatch = loc.city.toLowerCase().includes(searchLower);
      const stateMatch = loc.state.toLowerCase().includes(searchLower);
      const fullMatch = `${loc.city}, ${loc.state}`.toLowerCase().includes(searchLower);
      return cityMatch || stateMatch || fullMatch;
    })
      .slice(0, 10)
      .map((loc) => ({
        city: loc.city,
        state: loc.state,
        display: `${loc.city}, ${loc.state}`,
      }));

    setLocationSuggestions(matches);
    setShowLocationDropdown(matches.length > 0);
  }, [location]);

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      alert("Permission to access camera roll is required!");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageUrl(result.assets[0].uri);
    }
  };

  const handleCreate = () => {
    if (!title.trim()) {
      alert("Please enter a title");
      return;
    }
    if (needTypes.length === 0) {
      alert("Please select at least one role type");
      return;
    }
    if (paymentType === "paid" && priceMin.trim() === "" && priceMax.trim() === "") {
      alert("Please enter a price range (min and/or max)");
      return;
    }
    createMutation.mutate();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn} testID="close-create">
          <X color="#E5E7EB" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>Create New Opportunity</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.subtitle}>Share a new opportunity with the community</Text>

        <Text style={styles.label}>
          Title <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Fashion Photographer Needed"
          placeholderTextColor="#6B7280"
          value={title}
          onChangeText={setTitle}
          testID="input-title"
        />

        <View style={[styles.row, styles.dropdownRow]}>
          <View style={[styles.halfField, showNeedDropdown && styles.activeDropdownContainer]}>
            <Text style={styles.label}>
              Roles Needed <Text style={styles.required}>*</Text>
            </Text>
            <Pressable
              style={styles.dropdown}
              onPress={() => {
                setTempSelectedTypes([...needTypes]);
                setShowNeedDropdown(!showNeedDropdown);
              }}
              testID="dropdown-needs"
            >
              <Text style={[styles.dropdownText, needTypes.length === 0 && styles.placeholder]} numberOfLines={1}>
                {needTypes.length === 0 ? "Select roles" : needTypes.length === 1 ? needTypes[0] : `${needTypes.length} roles selected`}
              </Text>
              <ChevronDown color="#E5E7EB" size={16} />
            </Pressable>
            {showNeedDropdown && (
              <View style={styles.dropdownMenu}>
                <ScrollView style={styles.dropdownScroll}>
                  {NEED_TYPES.map((type) => {
                    const isSelected = tempSelectedTypes.includes(type);
                    return (
                      <Pressable
                        key={type}
                        style={[styles.dropdownItem, isSelected && styles.dropdownItemSelected]}
                        onPress={() => {
                          setTempSelectedTypes(prev => 
                            prev.includes(type) 
                              ? prev.filter(t => t !== type)
                              : [...prev, type]
                          );
                        }}
                        testID={`need-${type}`}
                      >
                        <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextSelected]}>
                          {type}
                        </Text>
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <View style={styles.dropdownActions}>
                  <Pressable
                    style={styles.dropdownActionBtn}
                    onPress={() => {
                      setShowNeedDropdown(false);
                      setTempSelectedTypes([]);
                    }}
                  >
                    <Text style={styles.dropdownActionText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.dropdownActionBtn, styles.dropdownActionBtnPrimary]}
                    onPress={() => {
                      setNeedTypes([...tempSelectedTypes]);
                      setShowNeedDropdown(false);
                    }}
                  >
                    <Text style={[styles.dropdownActionText, styles.dropdownActionTextPrimary]}>Done</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>

          <View style={[styles.halfField, showLocationDropdown && styles.activeDropdownContainer]}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. New York, NY"
              placeholderTextColor="#6B7280"
              value={location}
              onChangeText={setLocation}
              testID="input-location"
            />
            {showLocationDropdown && locationSuggestions.length > 0 && (
              <View style={styles.locationDropdownMenu}>
                <FlatList
                  data={locationSuggestions}
                  keyExtractor={(item, index) => `${item.display}-${index}`}
                  renderItem={({ item }) => (
                    <Pressable
                      style={styles.dropdownItem}
                      onPress={() => {
                        setLocation(item.display);
                        setShowLocationDropdown(false);
                        setLocationSuggestions([]);
                      }}
                      testID={`location-${item.display}`}
                    >
                      <Text style={styles.dropdownItemText} numberOfLines={1}>
                        {item.display}
                      </Text>
                    </Pressable>
                  )}
                  style={styles.dropdownScroll}
                />
              </View>
            )}
          </View>
        </View>

        <Text style={styles.label}>Budget</Text>
        <View style={styles.payToggleRow}>
          <Pressable
            style={[styles.payToggleBtn, paymentType === "paid" && styles.payToggleBtnActive]}
            onPress={() => setPaymentType("paid")}
            testID="budget-paid"
          >
            <Text style={[styles.payToggleText, paymentType === "paid" && styles.payToggleTextActive]}>Paid</Text>
          </Pressable>
          <Pressable
            style={[styles.payToggleBtn, paymentType === "unpaid" && styles.payToggleBtnActive]}
            onPress={() => {
              setPaymentType("unpaid");
              setPriceMin("");
              setPriceMax("");
            }}
            testID="budget-unpaid"
          >
            <Text style={[styles.payToggleText, paymentType === "unpaid" && styles.payToggleTextActive]}>Unpaid</Text>
          </Pressable>
        </View>
        {paymentType === "paid" && (
          <View style={styles.row}>
            <View style={styles.halfField}>
              <TextInput
                style={styles.input}
                placeholder="Min $"
                inputMode="numeric"
                placeholderTextColor="#6B7280"
                value={priceMin}
                onChangeText={setPriceMin}
                testID="input-price-min"
              />
            </View>
            <View style={styles.halfField}>
              <TextInput
                style={styles.input}
                placeholder="Max $"
                inputMode="numeric"
                placeholderTextColor="#6B7280"
                value={priceMax}
                onChangeText={setPriceMax}
                testID="input-price-max"
              />
            </View>
          </View>
        )}

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe the opportunity in detail..."
          placeholderTextColor="#6B7280"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          testID="input-description"
        />

        <Text style={styles.label}>Image</Text>
        <Pressable
          style={styles.imagePickerBtn}
          onPress={handlePickImage}
          testID="pick-image"
        >
          {imageUrl ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: imageUrl }} style={styles.imagePreview} />
              <View style={styles.changeImageOverlay}>
                <ImagePlus color="#E5E7EB" size={24} />
                <Text style={styles.changeImageText}>Change Image</Text>
              </View>
            </View>
          ) : (
            <View style={styles.imagePickerContent}>
              <ImagePlus color="#6B7280" size={32} />
              <Text style={styles.imagePickerText}>Pick from Camera Roll</Text>
            </View>
          )}
        </Pressable>

        <Text style={styles.label}>Requirements</Text>
        <View style={styles.requirementsRow}>
          <TextInput
            style={[styles.input, styles.requirementInput]}
            placeholder="Add a requirement"
            placeholderTextColor="#6B7280"
            value={newRequirement}
            onChangeText={setNewRequirement}
            testID="input-requirement"
          />
          <Pressable
            style={styles.addBtn}
            onPress={handleAddRequirement}
            testID="add-requirement"
          >
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        </View>

        {requirements.length > 0 && (
          <View style={styles.requirementsList}>
            {requirements.map((req, i) => (
              <View key={i} style={styles.requirementItem}>
                <Text style={styles.requirementText}>• {req}</Text>
                <Pressable
                  onPress={() => setRequirements(requirements.filter((_, idx) => idx !== i))}
                  style={styles.removeReqBtn}
                  testID={`remove-req-${i}`}
                >
                  <X color="#9CA3AF" size={14} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <View style={styles.notificationRow}>
          <Text style={styles.notificationLabel}>Enable post notifications</Text>
          <Switch
            value={enableNotifications}
            onValueChange={setEnableNotifications}
            trackColor={{ false: "#23232B", true: "#4CB963" }}
            thumbColor={enableNotifications ? "#FFFFFF" : "#9CA3AF"}
            testID="notification-switch"
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={styles.createBtn}
          onPress={handleCreate}
          disabled={createMutation.isPending}
          testID="create-opportunity"
        >
          {createMutation.isPending ? (
            <ActivityIndicator color="#0B0B0F" />
          ) : (
            <Text style={styles.createBtnText}>Create Opportunity</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.previewBtn}
          onPress={() => setShowPreview(true)}
          testID="preview"
        >
          <Eye color="#E5E7EB" size={18} />
          <Text style={styles.previewBtnText}>Preview</Text>
        </Pressable>
      </View>

      <Modal
        visible={showPreview}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPreview(false)}
      >
        <View style={[styles.previewContainer, { paddingTop: insets.top }]}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewHeaderTitle}>Preview</Text>
            <Pressable
              onPress={() => setShowPreview(false)}
              style={styles.previewCloseBtn}
              testID="close-preview"
            >
              <X color="#E5E7EB" size={24} />
            </Pressable>
          </View>

          <ScrollView style={styles.previewScroll}>
            <View style={styles.previewCard}>
              <View style={styles.previewPostHeader}>
                <Image
                  source={{ uri: resolvedProfile.avatarUrl }}
                  style={styles.previewPostAvatar}
                />
                <View style={styles.previewPostHeaderInfo}>
                  <Text numberOfLines={1} style={styles.previewPostUsername}>
                    {resolvedProfile.displayName}
                  </Text>
                  <Text numberOfLines={1} style={styles.previewPostTime}>
                    Just now
                  </Text>
                </View>
                {profile?.social_links &&
                  (profile.social_links.instagram ||
                    profile.social_links.youtube) && (
                    <View style={styles.previewSocialIcons}>
                      {profile.social_links.instagram && (
                        <View style={styles.previewSocialIconBtn}>
                          <Instagram color="#C13584" size={16} />
                        </View>
                      )}
                      {profile.social_links.youtube && (
                        <View style={styles.previewSocialIconBtn}>
                          <Youtube color="#FF0000" size={16} />
                        </View>
                      )}
                    </View>
                  )}
              </View>

              <View style={styles.previewMediaWrap}>
                <Image
                  source={{
                    uri:
                      imageUrl ||
                      "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?w=1200&auto=format&fit=crop&q=60",
                  }}
                  style={styles.previewCover}
                  resizeMode="cover"
                />
              </View>

              <View style={styles.previewBody}>
                {!!title && (
                  <Text numberOfLines={2} style={styles.previewCaption}>{title}</Text>
                )}
                {!!description && (
                  <Text numberOfLines={3} style={styles.previewDescription}>{description}</Text>
                )}
                <View style={styles.previewMetaRow}>
                  {needTypes.length > 0 && needTypes.map((type, idx) => (
                    <View key={idx} style={styles.previewMetaBadge}>
                      <Text style={styles.previewMetaBadgeText}>{type}</Text>
                    </View>
                  ))}
                  {!!location && (
                    <Text style={styles.previewMetaText}>📍 {location}</Text>
                  )}
                </View>
                {paymentType === "unpaid" && (
                  <View style={styles.previewPriceRow}>
                    <Text style={styles.previewPriceValue}>Unpaid</Text>
                  </View>
                )}
                {paymentType === "paid" && (priceMin.trim() !== "" || priceMax.trim() !== "") && (
                  <View style={styles.previewPriceRow}>
                    <Text style={styles.previewPriceValue}>
                      {`Paid ${[priceMin && `${Number(priceMin.replace(/[^0-9.]/g, "")).toLocaleString()}`, priceMax && `${Number(priceMax.replace(/[^0-9.]/g, "")).toLocaleString()}`].filter(Boolean).join(" - ")}`.trim()}
                    </Text>
                  </View>
                )}
                {requirements.length > 0 && (
                  <View style={styles.previewRequirementsSection}>
                    <Text style={styles.previewRequirementsTitle}>Requirements:</Text>
                    {requirements.map((req, idx) => (
                      <Text key={idx} style={styles.previewRequirementItem}>• {req}</Text>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.previewFooterRow}>
                <View style={styles.previewActionButtons}>
                  <View style={styles.previewActionBtn}>
                    <CheckCircle2 color="#E5E7EB" size={16} />
                    <Text style={styles.previewActionText}>Apply</Text>
                  </View>
                  <View style={styles.previewActionBtn}>
                    <Bookmark color="#E5E7EB" size={16} />
                    <Text style={styles.previewActionText}>Save</Text>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B0F",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#23232B",
  },
  closeBtn: {
    padding: 8,
  },
  headerTitle: {
    color: "#E5E7EB",
    fontSize: 18,
    fontWeight: "900",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    overflow: "visible",
  },
  subtitle: {
    color: "#9CA3AF",
    fontSize: 14,
    marginBottom: 24,
  },
  label: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 16,
  },
  required: {
    color: "#EF4444",
  },
  input: {
    backgroundColor: "#14141C",
    borderColor: "#23232B",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#E5E7EB",
    fontSize: 14,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    overflow: "visible",
  },
  dropdownRow: {
    alignItems: "flex-start",
  },
  halfField: {
    flex: 1,
    position: "relative",
    zIndex: 1,
  },
  activeDropdownContainer: {
    zIndex: 200,
    elevation: 20,
  },
  dropdown: {
    backgroundColor: "#14141C",
    borderColor: "#23232B",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownText: {
    color: "#E5E7EB",
    fontSize: 14,
  },
  placeholder: {
    color: "#6B7280",
  },
  dropdownMenu: {
    left: 0,
    right: 0,
    backgroundColor: "#14141C",
    borderColor: "#23232B",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    maxHeight: 200,
    zIndex: Platform.OS === "web" ? 9999 : 1000,
    elevation: 12,
    ...(Platform.OS === "web"
      ? {
          position: "relative" as const,
          marginTop: 8,
        }
      : {
          position: "absolute" as const,
          top: 70,
        }),
    ...(Platform.OS === "web" && {
      boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
    }),
  },
  locationDropdownMenu: {
    left: 0,
    right: 0,
    backgroundColor: "#14141C",
    borderColor: "#23232B",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    maxHeight: 250,
    zIndex: Platform.OS === "web" ? 9999 : 1000,
    elevation: 12,
    ...(Platform.OS === "web"
      ? {
          position: "relative" as const,
          marginTop: 8,
        }
      : {
          position: "absolute" as const,
          top: 70,
        }),
    ...(Platform.OS === "web" && {
      boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
    }),
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  dropdownItemText: {
    color: "#E5E7EB",
    fontSize: 14,
  },
  dropdownItemSelected: {
    backgroundColor: "#1A1A24",
  },
  dropdownItemTextSelected: {
    color: "#4CB963",
    fontWeight: "700" as const,
  },
  checkmark: {
    color: "#4CB963",
    fontSize: 16,
    fontWeight: "700" as const,
  },
  dropdownActions: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#23232B",
    gap: 8,
  },
  dropdownActionBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#14141C",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#23232B",
    alignItems: "center" as const,
  },
  dropdownActionBtnPrimary: {
    backgroundColor: "#E5E7EB",
    borderColor: "#E5E7EB",
  },
  dropdownActionText: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "700" as const,
  },
  dropdownActionTextPrimary: {
    color: "#0B0B0F",
  },
  requirementsRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  requirementInput: {
    flex: 1,
  },
  addBtn: {
    backgroundColor: "#14141C",
    borderColor: "#23232B",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  addBtnText: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "700",
  },
  requirementsList: {
    marginTop: 12,
    gap: 8,
  },
  requirementItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#14141C",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  requirementText: {
    color: "#E5E7EB",
    fontSize: 13,
    flex: 1,
  },
  removeReqBtn: {
    padding: 4,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#23232B",
  },
  createBtn: {
    backgroundColor: "#E5E7EB",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  createBtnText: {
    color: "#0B0B0F",
    fontSize: 16,
    fontWeight: "900",
  },
  previewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  previewBtnText: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "700",
  },
  imagePickerBtn: {
    backgroundColor: "#14141C",
    borderColor: "#23232B",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    overflow: "hidden",
    minHeight: 150,
  },
  imagePickerContent: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  imagePickerText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "600",
  },
  imagePreviewContainer: {
    position: "relative" as const,
    width: "100%",
    height: 200,
  },
  imagePreview: {
    width: "100%",
    height: "100%",
    resizeMode: "cover" as const,
  },
  changeImageOverlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(11, 11, 15, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  changeImageText: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "600",
  },
  previewContainer: {
    flex: 1,
    backgroundColor: "#0B0B0F",
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#23232B",
    position: "relative" as const,
  },
  previewHeaderTitle: {
    color: "#E5E7EB",
    fontSize: 18,
    fontWeight: "900",
  },
  previewCloseBtn: {
    position: "absolute" as const,
    right: 16,
    padding: 8,
  },
  previewScroll: {
    flex: 1,
  },
  previewCard: {
    backgroundColor: "#121218",
    borderColor: "#23232B",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: "hidden",
    margin: 12,
  },
  previewPostHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  previewSocialIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: "auto" as const,
  },
  previewSocialIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#14141C",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#23232B",
  },
  previewPostAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  previewPostHeaderInfo: {
    flex: 1,
  },
  previewPostUsername: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "800",
  },
  previewPostTime: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "700",
  },
  previewMediaWrap: {
    paddingHorizontal: 8,
    paddingTop: 6,
  },
  previewCover: {
    width: "100%",
    height: 320,
    borderRadius: 14,
  },
  previewBody: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  previewCaption: {
    color: "#E5E7EB",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 6,
  },
  previewDescription: {
    color: "#D1D5DB",
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20,
    marginBottom: 8,
  },
  previewMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
    flexWrap: "wrap",
  },
  previewMetaBadge: {
    backgroundColor: "#1E40AF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  previewMetaBadgeText: {
    color: "#BFDBFE",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  previewMetaText: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "600",
  },
  previewPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  previewPriceLabel: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "600",
  },
  previewPriceValue: {
    color: "#10B981",
    fontSize: 14,
    fontWeight: "800",
  },
  payToggleRow: {
    flexDirection: "row",
    gap: 8,
  },
  payToggleBtn: {
    flex: 1,
    backgroundColor: "#14141C",
    borderColor: "#23232B",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  payToggleBtnActive: {
    backgroundColor: "#1A1A24",
    borderColor: "#4CB963",
    borderWidth: 2,
  },
  payToggleText: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "700",
  },
  payToggleTextActive: {
    color: "#4CB963",
  },
  previewRequirementsSection: {
    marginTop: 8,
    gap: 4,
  },
  previewRequirementsTitle: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  previewRequirementItem: {
    color: "#D1D5DB",
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 18,
  },
  previewFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 12,
    marginTop: 4,
    marginBottom: 10,
  },
  previewActionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  previewActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#1A1A24",
    borderWidth: 1.5,
    borderColor: "#2A2A38",
  },
  previewActionText: {
    color: "#D1D5DB",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  notificationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginTop: 8,
    maxWidth: "100%",
  },
  notificationLabel: {
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
    flexShrink: 1,
    marginRight: 16,
  },
});
