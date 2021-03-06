/// <reference path='Definitions/angular.d.ts' />
/// <reference path='Definitions/blizzard.d.ts' />
/// <reference path='Definitions/ga.d.ts' />
/// <reference path='Definitions/app.d.ts' />
/// <reference path='utils.ts' />

module AchievementComparer {
    'use strict';
    
    var Regions: Region[] = [
        {
            code: "US",
            desc: "Americas",
            host: "http://us.battle.net",
            locales:
            [
                "en_US", // "English (US)",
                "es_MX", // "Spanish (Mexico)",
                "pt_BR" // "Brazilian Portuguese"
            ]
        },
        {
            code: "EU",
            desc: "Europe",
            host: "http://eu.battle.net",
            locales:
            [
                "en_GB", // "English (UK)",
                "es_ES", // "Spanish (Spain)",
                "fr_FR", // "French",
                "ru_RU", // "Russian",
                "de_DE", // "German",
                "pt_PT", // "Portuguese",
                "it_IT", // "Italian"
            ]
        },
        {
            code: "KR",
            desc: "Korea",
            host: "http://kr.battle.net",
            locales: ["ko_KR"] // "Korean"
        },
        {
            code: "TW",
            desc: "Taiwan",
            host: "http://tw.battle.net",
            locales: ["zh_TW"] //"Chinese, Traditional"
        },
        {
            code: "CN",
            desc: "China",
            host: "http://www.battlenet.com.cn",
            locales: ["zh_CN"] //"Chinese, Simplified"
        }];

    var CachedCharacters: BattleNet.Character[];
    
    export class Contender {
        Avatar: string;
        Character: BattleNet.Character;

        constructor(address?: string) {
            this.Avatar = this.formatAvatar();
            if (address) this.loadCharacter(address, false);
        }

        private formatAvatar(): string {
            if (this.Character) return "{0}/static-render/eu/{1}?alt=/wow/static/images/2d/avatar/{2}-{3}.jpg".format(Regions[1].host, this.Character.thumbnail, this.Character.race, this.Character.gender);
            else return "{0}/wow/static/images/2d/avatar/{1}-{2}.jpg".format(Regions[1].host, Math.floor((Math.random() * 11) + 1), Math.floor((Math.random() * 2)));
        }

        private loadCharacter(address: string, forceReload?: boolean) {
            if (this.Character === null || "{0}@{1}".format(this.Character.name, this.Character.realm) !== address) {
                var callback = (character: BattleNet.Character) => { this.Character = character; this.Avatar = this.formatAvatar(); };
                if (forceReload)
                    $.getJSON("{0}/api/wow/character/{1}?locale={2}&fields=achievements,guild&jsonp=?".format(Regions[1].host, address, Regions[0].locales[0])).done(callback);
                else callback(CachedCharacters.single((character) => { return (address) === address.split("@").reverse().join("/") } ));
            }
        }

        unLoadCharacter() {
            this.Character = null;
            this.Avatar = this.formatAvatar();
        }

        reloadCharacter() {
            if (this.Character) {
                $.getJSON("{0}/api/wow/character/{1}/{2}?locale={3}&fields=achievements,guild&jsonp=?".format(Regions[1].host, this.Character.realm, this.Character.name, Regions[0].locales[0])).done((character: BattleNet.Character) => {
                    this.Character = character;
                    this.Avatar = this.formatAvatar();
                });
            }
        }
    }


    export class Storage implements IStorage {
        currentLocale: string;
        currentRegion: Region;
        lastLeftContender: string;
        lastRightContender: string;
        localeData: LocaleData;
        cachedCharacters: BattleNet.Character[];

        public injection(): any[] {
            return [
                Storage
            ]
        }

        constructor() {
            this.setLocale(Regions[1].locales[0]);
            this.lastLeftContender = localStorage.getItem("leftContender");
            this.lastRightContender = localStorage.getItem("rightContender");
        }

        setLocale(locale: string): void {
            this.localeData = JSON.parse(localStorage.getItem("data"));
            if (this.localeData === null || this.localeData.locale != locale) {
                var achievements: BattleNet.AchievementCategory[];
                var classes: BattleNet.CharacterClass[];
                var races: BattleNet.CharacterRace[];
                var realms: BattleNet.RealmStatus[];

                $.getJSON("{0}/api/wow/data/character/achievemetns?locale={1}&jsonp=?".format(Regions[1].host, locale)).done((json: BattleNet.Achievements) => {
                    achievements = json.achievements;
                    if ([classes, races, realms].every((current) => { return current != null })) {
                        localStorage.setItem("data", JSON.stringify(this.localeData = { locale: locale, achievements: achievements, classes: classes, races: races, realms: realms }));
                    }
                });

                $.getJSON("{0}/api/wow/data/character/classes?locale={1}&jsonp=?".format(Regions[1].host, locale)).done((json: BattleNet.Classes) => {
                    classes = json.classes;
                    if ([achievements, races, realms].every((current) => { return current != null })) {
                        localStorage.setItem("data", JSON.stringify(this.localeData = { locale: locale, achievements: achievements, classes: classes, races: races, realms: realms }));
                    }
                });

                $.getJSON("{0}/api/wow/data/character/races?locale={1}&jsonp=?".format(Regions[1].host, locale)).done((json: BattleNet.Races) => {
                    races = json.races;
                    if ([achievements, classes, realms].every((current) => { return current != null })) {
                        localStorage.setItem("data", JSON.stringify(this.localeData = { locale: locale, achievements: achievements, classes: classes, races: races, realms: realms }));
                    }
                });

                $.getJSON("{0}/api/wow/realm/status?locale={1}&jsonp=?".format(Regions[1].host, locale)).done((json: BattleNet.Realms) => {
                    realms = json.realms;
                    if ([achievements, classes, races].every((current) => { return current != null })) {
                        localStorage.setItem("data", JSON.stringify(this.localeData = { locale: locale, achievements: achievements, classes: classes, races: races, realms: realms }));;
                    }
                });
            }
        }
    }

    export class Controller {
        public injection(): any[] {
            return [
                '$scope',
                '$location',
                'Storage',
                'filterFilter',
                Controller
            ]
        }

        constructor(
           private $scope: IScope,
           private $location: ng.ILocationService,
           private Storage: IStorage,
           private filterFilter
           ) {
            $scope.Math = Math;

            $scope.currentLocale = Storage.localeData.locale;
            $scope.regions = Regions;
            $scope.region = $scope.regions.single((region) => { return region.locales.indexOf($scope.currentLocale) > -1; } );
            $scope.leftContender = new Contender(Storage.lastLeftContender);
            $scope.rightContender = new Contender(Storage.lastRightContender);

            $scope.$watch('currentLocale', () => { Storage.setLocale($scope.currentLocale); $scope.region = $scope.regions.single((region) => { return region.locales.indexOf($scope.currentLocale) > -1; }); });

            $scope.$watch((scope) => { return Storage.cachedCharacters; }, () => { $scope.cachedCharacters = Storage.cachedCharacters; });

            $scope.$watch((scope) => { return Storage.localeData; }, () => { if (Storage.localeData) $scope.categories = Storage.localeData.achievements; });

            $scope.$watch('location.path()', (path) => this.onPath(path));

            $scope.achievementProgress = (contender: BattleNet.Character, achievementId: number): string => {
                if (contender.achievements.achievementsCompleted.indexOf(achievementId) == -1)
                    return "Incomplete";
                return new Date(contender.achievements.achievementsCompletedTimestamp[contender.achievements.achievementsCompleted.indexOf(achievementId)]).toDateString();
            };

            $scope.criteriaProgress = (contender: BattleNet.Character, criteriaId: number): string => {
                if (contender.achievements.criteria.indexOf(criteriaId) == -1)
                    return "0";
                return contender.achievements.criteriaQuantity[contender.achievements.criteria.indexOf(criteriaId)].toString();
            };

            $scope.sortWeight = (achievement: BattleNet.Achievement): number => {
                var weight = 4;
                if ($scope.leftContender.Character.achievements.achievementsCompleted.indexOf(achievement.id) != -1) weight -= 2;
                if ($scope.rightContender.Character.achievements.achievementsCompleted.indexOf(achievement.id) != -1) weight -= 1;
                return weight;
            };

            $scope.classDesc = (classId) => {
                return (classId === undefined) ? "" : Storage.localeData.classes.single((currentClass) => { return currentClass.id == classId }).name
            };

            $scope.raceDesc = (raceId) => {
                return (raceId === undefined) ? "" : Storage.localeData.races.single((currentRace) => { return currentRace.id == raceId }).name
            };

            $scope.location = $location;
        }

        onPath(path: string) {
            if (!(this.$scope.leftContender.Character && this.$scope.leftContender.Character)) return;
            if (path === "") path = "/" + this.$scope.categories[0].name;
            var categoryPath = path.split("/");
            if (categoryPath.length == 2) {
                var category = this.$scope.categories.single((category) => { return category.name == categoryPath[1] });
                var total = 0, leftContenderProgress = 0, rightContenderProgress = 0;
                category.achievements.forEach((achievement) => {
                    total += achievement.points;
                    if (this.$scope.leftContender.Character.achievements.achievementsCompleted.indexOf(achievement.id) >= 0)
                        leftContenderProgress += achievement.points;
                    if (this.$scope.rightContender.Character.achievements.achievementsCompleted.indexOf(achievement.id) >= 0)
                        rightContenderProgress += achievement.points;
                });
                this.$scope.category = Object.create(category, { total: { value: total }, leftContenderProgress: { value: leftContenderProgress }, rightContenderProgress: { value: rightContenderProgress } });
            } else if (categoryPath.length == 3) {
                var category = this.$scope.categories.single((currentCategory) => { return currentCategory.name == categoryPath[1] });
                var subcategory = category.categories.single((currentSubcategory) => { return currentSubcategory.name == categoryPath[2] });
                var total = 0, leftContenderProgress = 0, rightContenderProgress = 0;
                subcategory.achievements.forEach((achievement) => {
                    total += achievement.points;
                    if (this.$scope.leftContender.Character.achievements.achievementsCompleted.indexOf(achievement.id) >= 0)
                        leftContenderProgress += achievement.points;
                    if (this.$scope.rightContender.Character.achievements.achievementsCompleted.indexOf(achievement.id) >= 0)
                        rightContenderProgress += achievement.points;
                });
                this.$scope.category = Object.create(subcategory, { total: { value: total }, leftContenderProgress: { value: leftContenderProgress }, rightContenderProgress: { value: rightContenderProgress } });
            }

            // Push location changes to google analytics
            _gaq.push(['_trackPageview', path]);

            document.body.scrollTop = 0;
        }
    }

    angular.module('AchievementComparer', [])
            .controller('Controller', Controller.prototype.injection())
            .service('Storage', Storage.prototype.injection());
}